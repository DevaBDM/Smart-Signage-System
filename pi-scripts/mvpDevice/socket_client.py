import os
import time
import socket
import threading
import socketio
import api
import media
import player
import scheduler
from config import SERVER_URL, DEVICE_ID, DEVICE_NAME, LOCATION, EMERGENCY_FALLBACK

# Event to wake the sync loop immediately after token handshake
sync_event = threading.Event()


def _write_emergency_flag(active):
    """Write shared flag file so brightness_control knows emergency state."""
    flag = "/tmp/signage_emergency_active"
    try:
        if active:
            with open(flag, "w") as f:
                f.write("1")
        elif os.path.exists(flag):
            os.remove(flag)
    except Exception as e:
        print(f"[emergency] Failed to update emergency flag file: {e}")


def _asset_id_for_post(post_id):
    """Deterministic asset_id the backend can track."""
    return f"mvp-{post_id}"


def _post_id_from_asset_id(asset_id):
    """Reverse an asset_id back to post_id."""
    if isinstance(asset_id, str) and asset_id.startswith("mvp-"):
        try:
            return int(asset_id.split("-", 1)[1])
        except Exception:
            pass
    return None

sio = socketio.Client(reconnection=False)

@sio.event
def connect():
    print("[socket] Connected to server")
    if api.load_token():
        sync_event.set()

@sio.event
def disconnect():
    print("[socket] Disconnected")

@sio.on("device_token")
def on_device_token(data):
    token = data.get("token")
    if token:
        api.save_token(token)
        print(f"[socket] Received device_token for device {data.get('device_id')}")
        sync_event.set()

@sio.on("signage_command")
def on_signage_command(data):
    print(f"[socket] Signage command: {data}")
    if media.is_emergency():
        print("[socket] Command rejected: emergency mode active")
        return {"ok": False, "error": "Emergency mode active"}
    try:
        action = data.get("action")

        if action == "list":
            posts = media.list_posts()
            print(f"[socket] list: returning {len(posts)} posts")
            assets = []
            for p in posts:
                pid = p.get("post_id")
                name = p.get("title", f"Post {pid}")
                # Backend parsePostIdFromAssetName expects "(post_id)" suffix
                if pid is not None and not name.endswith(f"({pid})"):
                    name = f"{name} ({pid})"
                assets.append({
                    "asset_id": _asset_id_for_post(pid),
                    "name": name,
                    "uri": p.get("local_path") or p.get("image_url") or p.get("stream_url"),
                    "mimetype": "video" if (p.get("media_type") or "IMAGE") != "IMAGE" else "image",
                    "duration": p.get("duration_seconds"),
                    "is_enabled": p.get("is_enabled", True),
                    "is_active": media._is_active(p),
                    "start_date": p.get("start_date"),
                    "end_date": p.get("end_date"),
                    "play_order": p.get("priority"),
                })
            print(f"[socket] list: built {len(assets)} assets")
            return {"ok": True, "assets": assets}

        if action == "publish_asset":
            post = {
                "post_id": data.get("post_id"),
                "title": data.get("title"),
                "image_url": data.get("image_url"),
                "media_type": data.get("media_type", "IMAGE"),
                "stream_url": data.get("stream_url"),
                "duration_seconds": data.get("duration_seconds"),
                "start_date": data.get("start_date"),
                "end_date": data.get("end_date"),
                "is_enabled": data.get("is_enabled", True),
                "priority": data.get("play_order") or data.get("priority", 1),
            }
            post = media.ensure_cached(post)
            media.add_or_update_post(post)
            print(f"[socket] Added/updated post {post['post_id']}")
            asset_id = _asset_id_for_post(post["post_id"])
            asset_name = post.get("title", f"Post {post['post_id']}")
            if not asset_name.endswith(f"({post['post_id']})"):
                asset_name = f"{asset_name} ({post['post_id']})"
            return {
                "ok": True,
                "post_id": post["post_id"],
                "asset": {"asset_id": asset_id, "name": asset_name},
                "image_url": post.get("image_url") or post.get("stream_url"),
            }

        if action == "clear_all":
            media.clear_all()
            player.mpv.stop()
            print("[socket] Cleared all posts")
            return {"ok": True}

        if action == "delete_asset":
            asset_id = data.get("asset_id")
            post_id = _post_id_from_asset_id(asset_id)
            if post_id:
                media.remove_post(post_id)
                print(f"[socket] Deleted asset {asset_id} (post {post_id})")
                return {"ok": True}
            return {"ok": False, "error": f"Unknown asset_id: {asset_id}"}

        if action == "delete_post_assets":
            post_id = data.get("post_id")
            media.remove_post(post_id)
            print(f"[socket] Removed post {post_id}")
            return {"ok": True}

        if action == "hide_asset":
            post_id = _post_id_from_asset_id(data.get("asset_id"))
            if post_id:
                media.hide_post(post_id)
                print(f"[socket] Hidden post {post_id}")
                return {"ok": True}
            return {"ok": False, "error": "Missing or invalid asset_id"}

        if action == "show_asset":
            post_id = _post_id_from_asset_id(data.get("asset_id"))
            if post_id:
                media.show_post(post_id)
                print(f"[socket] Shown post {post_id}")
                return {"ok": True}
            return {"ok": False, "error": "Missing or invalid asset_id"}

        if action == "next":
            scheduler.request_jump(direction="next")
            print("[socket] Advancing to next post")
            return {"ok": True}

        if action == "previous":
            scheduler.request_jump(direction="previous")
            print("[socket] Going to previous post")
            return {"ok": True}

        if action == "start":
            post_id = _post_id_from_asset_id(data.get("asset_id"))
            if post_id:
                scheduler.request_jump(post_id=post_id)
                print(f"[socket] Starting post {post_id}")
                return {"ok": True}
            return {"ok": False, "error": "Missing or invalid asset_id"}

        return {"ok": False, "error": f"Unknown signage action: {action}"}
    except Exception as e:
        print(f"[socket] signage_command failed: {e}")
        if sio.connected:
            sio.emit(
                "error_log",
                {
                    "device_id": DEVICE_ID,
                    "error_type": "signage_command_failed",
                    "message": str(e),
                },
            )
        return {"ok": False, "error": str(e)}

@sio.on("playlist_update")
def on_playlist_update(data):
    if media.is_emergency():
        print("[socket] playlist_update rejected: emergency mode active")
        if sio.connected:
            sio.emit("playlist_ack", {"device_id": DEVICE_ID})
        return {"ok": False, "error": "Emergency mode active"}
    result = on_signage_command({"action": "publish_asset", **data})
    if sio.connected:
        sio.emit("playlist_ack", {"device_id": DEVICE_ID})
    return result


@sio.on("refresh_display")
def on_refresh_display(data):
    if media.is_emergency():
        print("[socket] Refresh blocked: emergency mode active")
        return
    if media.is_disconnected_mode():
        print("[socket] Refresh blocked: disconnection mode active")
        return
    print("[socket] Refresh display requested")
    player.ensure_mpv_running()
    # Force reload of current media by resetting last_change
    _state, _lock = media.get_state()
    with _lock:
        _state["last_change"] = 0


@sio.on("restart_display")
def on_restart_display(data):
    if media.is_emergency():
        print("[socket] Restart blocked: emergency mode active")
        return
    if media.is_disconnected_mode():
        print("[socket] Restart blocked: disconnection mode active")
        return
    print("[socket] Restart display requested")
    player.stop_mpv()
    time.sleep(1)
    player.start_mpv()


@sio.on("emergency_mode_start")
def on_emergency_mode_start(data):
    if media.is_emergency():
        print("[socket] Emergency already active, ignoring duplicate start")
        return
    print(f"[socket] Emergency mode started by device {data.get('triggered_by')} for groups {data.get('groups')}")
    media.set_emergency(True)
    _write_emergency_flag(True)
    player.play_emergency(EMERGENCY_FALLBACK)


@sio.on("emergency_mode_end")
def on_emergency_mode_end(data):
    print(f"[socket] Emergency mode ended for group {data.get('group_id')} (cleared by {data.get('cleared_by')})")

    # Check ALL device groups before clearing — stay emergency if any group still emergency
    try:
        device = api.fetch_device_settings()
        if device:
            groups = []
            if device.get("group"):
                groups.append(device["group"])
            for dg in device.get("groups", []):
                g = dg.get("group")
                if g:
                    groups.append(g)
            any_emergency = any(g.get("signage_state") == "EMERGENCY" for g in groups)
            if any_emergency:
                print(f"[socket] {sum(1 for g in groups if g.get('signage_state') == 'EMERGENCY')} other group(s) still EMERGENCY — staying in emergency mode")
                return
    except Exception as e:
        print(f"[socket] Failed to check group states: {e}")
        return

    media.set_emergency(False)
    _write_emergency_flag(False)
    # Force scheduler to resume normal content immediately
    scheduler.request_jump(direction="next")


@sio.on("auth_error")
def on_auth_error(data):
    print(f"[socket] Auth error from server: {data}")
    # Do NOT clear the local token here. The backend requires the exact
    # token stored in the DB; clearing it would cause an infinite loop of
    # "no token presented" → auth_error → reconnect without token.
    # If the token is truly invalid, an admin must reset it via dashboard.
    sync_event.set()

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
                        "ip_address": _get_local_ip(),
                        "status": "online",
                        "player": "mpv",
                    },
                )
        except Exception as e:
            print(f"[heartbeat] {e}")
        time.sleep(10)

def socket_loop():
    retry_delay = 5
    while True:
        try:
            base_url = SERVER_URL.split("/api")[0]
            token = api.load_token()
            connect_kwargs = {}
            if token:
                connect_kwargs["auth"] = {"token": token}
            sio.connect(base_url, **connect_kwargs)
            sio.wait()
            retry_delay = 5  # Reset on clean disconnect / successful session end
        except Exception as e:
            print(f"[socket] Reconnecting in {retry_delay}s... ({e})")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 30)  # Capped exponential backoff

def _get_local_ip():
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        probe.close()
        return ip
    except Exception:
        return socket.gethostname()
