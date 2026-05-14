import socket
import socketio, time, threading
from config import DEVICE_ID, DEVICE_NAME, LOCATION, SERVER_URL, SERIAL_PORT, BAUD_RATE

RAIN_THRESHOLD = 500

sio = socketio.Client()

# ── Server → Pi events ───────────────────────────────────────


@sio.event
def connect():
    print("[socket] Connected to server")


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
        if action == "publish_asset":
            return push_to_anthias(data)
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


def sensor_loop():
    try:
        import serial

        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        time.sleep(2)
        while True:
            line = ser.readline().decode("utf-8").strip()
            if not line.startswith("SENSOR:"):
                continue
            # SENSOR:motion:1,brightness:742,rain:0
            try:
                _, payload = line.split(":", 1)
                # Write to temp file for other scripts (like brightness_control.py)
                with open("/tmp/signage_sensors", "w") as f:
                    f.write(payload)

                values = dict(p.split(":") for p in payload.split(","))
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
            sio.connect(base_url)
            sio.wait()
        except Exception as e:
            print(f"[socket] Reconnecting in 5s... ({e})")
            time.sleep(5)
