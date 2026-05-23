import os
import socket
import socketio, time, threading
from config import DEVICE_ID, DEVICE_NAME, LOCATION, SERVER_URL, SERIAL_PORT, BAUD_RATE, DEVICE_TOKEN

RAIN_THRESHOLD = 500

# Token persistence path (same directory as this script)
TOKEN_FILE = os.path.join(os.path.dirname(__file__), ".device_token")

_current_token = DEVICE_TOKEN or ""


def _load_token():
    global _current_token
    if _current_token:
        return
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            _current_token = f.read().strip()


def _save_token(token):
    global _current_token
    _current_token = token
    with open(TOKEN_FILE, "w") as f:
        f.write(token)
    print(f"[socket] Saved device token to {TOKEN_FILE}")


_load_token()
sio = socketio.Client()

# ── Server → Pi events ───────────────────────────────────────


@sio.event
def connect():
    print("[socket] Connected to server")


@sio.on("device_token")
def on_device_token(data):
    """Server sends us our token after first heartbeat registration."""
    token = data.get("token")
    if token:
        _save_token(token)
        print(f"[socket] Received device_token for device {data.get('device_id')}")


@sio.event
def disconnect():
    print("[socket] Disconnected")


@sio.on("playlist_update")
def on_playlist_update(data):
    print(f"[socket] New playlist: {data}")
    try:
        from content_sync import push_to_anthias

        result = push_to_anthias(data)
        if result.get("ok"):
            sio.emit("playlist_ack", {"device_id": DEVICE_ID, **result})
        else:
            sio.emit(
                "error_log",
                {
                    "device_id": DEVICE_ID,
                    "error_type": "anthias_push_failed",
                    "message": f"Could not push asset to Anthias: {data}",
                },
            )
    except ImportError:
        print("[socket] content_sync.py or push_to_anthias not found")
    except Exception as e:
        print(f"[socket] playlist_update failed: {e}")
        if sio.connected:
            sio.emit(
                "error_log",
                {
                    "device_id": DEVICE_ID,
                    "error_type": "playlist_update_failed",
                    "message": str(e),
                },
            )


@sio.on("refresh_display")
def on_refresh(data):
    import subprocess

    subprocess.run(["pkill", "-HUP", "anthias"])


@sio.on("restart_display")
def on_restart(data):
    import subprocess

    subprocess.run(["sudo", "systemctl", "restart", "anthias"])


@sio.on("signage_command")
def on_signage_command(data):
    print(f"[socket] Signage command: {data}")
    try:
        from content_sync import (
            clear_all_assets,
            delete_asset,
            delete_post_assets,
            list_anthias_assets,
            playback_control,
            push_to_anthias,
            set_asset_enabled,
        )

        action = data.get("action")
        if action == "list":
            return {"ok": True, "assets": list_anthias_assets()}
        if action == "clear_all":
            res = clear_all_assets()
            # Force Anthias to refresh so the screen goes blank/default immediately
            import subprocess
            subprocess.run(["pkill", "-HUP", "anthias"], capture_output=True)
            return res
        if action == "publish_asset":
            result = push_to_anthias(data)
            if not result.get("ok") and sio.connected:
                sio.emit(
                    "error_log",
                    {
                        "device_id": DEVICE_ID,
                        "error_type": "publish_asset_failed",
                        "message": result.get("error") or "push_to_anthias failed",
                    },
                )
            return result
        if action == "delete_asset":
            return delete_asset(data.get("asset_id"))
        if action == "delete_post_assets":
            return delete_post_assets(
                post_id=data.get("post_id"),
                image_url=data.get("image_url"),
            )
        if action == "hide_asset":
            return set_asset_enabled(data.get("asset_id"), False)
        if action == "show_asset":
            return set_asset_enabled(data.get("asset_id"), True)
        if action in ("next", "previous", "start"):
            return playback_control(action, asset_id=data.get("asset_id"))
        return {"ok": False, "error": f"Unknown signage action: {action}"}
    except Exception as e:
        print(f"[socket] signage_command failed: {e}")
        return {"ok": False, "error": str(e)}


# ── Pi → Server: heartbeat loop ──────────────────────────────


def heartbeat_loop():
    while True:
        try:
            if sio.connected:
                sio.emit(
                    "heartbeat",
                    {
                        "device_id": DEVICE_ID,
                        "device_name": DEVICE_NAME,
                        "location": LOCATION,
                        "ip_address": get_local_ip(),
                        "status": "online",
                    },
                )
        except Exception as e:
            print(f"[heartbeat] {e}")
        time.sleep(10)


def get_local_ip():
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip_address = probe.getsockname()[0]
        probe.close()
        return ip_address
    except Exception:
        return socket.gethostname()


# ── Pi → Server: sensor loop (reads from Arduino serial) ─────


_emu2 = {"triggered": False}

def _push_local_emergency():
    """Push a locally cached emergency asset to Anthias immediately."""
    fallback = "/home/pi/emergency_fallback.mp4"
    if not os.path.exists(fallback):
        print("[emergency] No local fallback asset found")
        return
    try:
        from content_sync import register_anthias_asset
        payload = {
            "name": f"EMERGENCY ALERT (Device {DEVICE_ID})",
            "uri": fallback,
            "mimetype": "video" if fallback.lower().endswith((".mp4", ".webm", ".mov")) else "image",
            "duration": 0,
            "is_enabled": True,
            "skip_asset_check": True,
        }
        res = register_anthias_asset(payload)
        if res.get("ok"):
            print(f"[emergency] Local emergency asset pushed to Anthias")
            import subprocess
            subprocess.run(["pkill", "-HUP", "anthias"], capture_output=True)
        else:
            print(f"[emergency] Failed to push emergency asset: {res.get('error')}")
    except Exception as e:
        print(f"[emergency] Local emergency push failed: {e}")

def sensor_loop():
    try:
        import serial

        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        time.sleep(2)
        while True:
            line = ser.readline().decode("utf-8").strip()
            if not line.startswith("SENSOR:"):
                continue
            # SENSOR:motion:1,brightness:742,rain:0,emergency:1
            try:
                _, payload = line.split(":", 1)
                # Write to temp file for other scripts (like brightness_control.py)
                with open("/tmp/signage_sensors", "w") as f:
                    f.write(payload)

                values = dict(p.split(":") for p in payload.split(","))

                # Emergency button detection
                emergency_raw = values.get("emergency", "0")
                if emergency_raw == "1" and not _emu2["triggered"]:
                    print("[sensor_loop] EMERGENCY BUTTON DETECTED")
                    _emu2["triggered"] = True
                    # Notify server immediately
                    if sio.connected:
                        try:
                            sio.emit("emergency_trigger", {"device_id": DEVICE_ID})
                            print("[sensor_loop] emergency_trigger emitted")
                        except Exception as e:
                            print(f"[sensor_loop] emergency_trigger emit failed: {e}")
                    # Local fail-safe: push cached emergency asset to Anthias
                    _push_local_emergency()
                elif emergency_raw == "0" and _emu2["triggered"]:
                    _emu2["triggered"] = False

                if sio.connected:
                    sio.emit(
                        "sensor_update",
                        {
                            "device_id": DEVICE_ID,
                            "motion": values.get("motion", "0") == "1",
                            "brightness": int(values.get("brightness", 0)),
                            "rain": int(values.get("rain", 0)) >= RAIN_THRESHOLD,
                        },
                    )
            except Exception as e:
                print(f"[sensor_loop] parse error: {e}")
    except Exception as e:
        print(f"[sensor_loop] {e}")


def content_sync_loop():
    try:
        from content_sync import sync
    except ImportError:
        print("[content_sync_loop] content_sync.py not found")
        return

    while True:
        try:
            pushed_assets = sync()
            # sync() returns None if server is down (after my previous fix)
            # but wait, let me check my previous edit.
            # actually sync() returns [] if server is down.
            if pushed_assets and sio.connected:
                for result in pushed_assets:
                    if result.get("ok"):
                        sio.emit(
                            "signage_asset_synced",
                            {"device_id": DEVICE_ID, **result},
                        )
            
            # If server was unreachable, sleep longer before retrying to avoid spamming logs
            if pushed_assets == [] and not sio.connected:
                time.sleep(120) 
                continue

        except Exception as e:
            print(f"[content_sync_loop] {e}")
        time.sleep(60)


# ── Main ──────────────────────────────────────────────────────

if __name__ == "__main__":
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    threading.Thread(target=sensor_loop, daemon=True).start()
    threading.Thread(target=content_sync_loop, daemon=True).start()

    while True:
        try:
            # SERVER_URL is usually like http://localhost:5000/api
            # Socket.IO connects to the base URL
            base_url = SERVER_URL.split("/api")[0]
            connect_kwargs = {}
            if _current_token:
                connect_kwargs["auth"] = {"token": _current_token}
            sio.connect(base_url, **connect_kwargs)
            sio.wait()
        except Exception as e:
            print(f"[socket] Reconnecting in 5s... ({e})")
            time.sleep(5)
