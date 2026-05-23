"""
MVP Player — Standalone Signage Player Orchestrator
"""
import time
import threading
import media
import player
import api
import socket_client
import scheduler
import sensors
from config import SYNC_INTERVAL

def sync_loop():
    """Background thread: periodic sync with server.
    Retries quickly (10s) after failures and immediately after token events."""
    while True:
        wait_time = SYNC_INTERVAL
        try:
            new_posts = api.sync_deployments(media.ensure_cached)
            if new_posts is not None:
                media.update_posts(new_posts)
                print(f"[sync] Stored {len(new_posts)} posts")
                # Emit sync confirmations like Device1's content_sync_loop
                sio = socket_client.sio
                if sio.connected:
                    for post in new_posts:
                        pid = post.get("post_id")
                        asset_id = socket_client._asset_id_for_post(pid)
                        asset_name = post.get("title", f"Post {pid}")
                        if pid is not None and not asset_name.endswith(f"({pid})"):
                            asset_name = f"{asset_name} ({pid})"
                        sio.emit(
                            "signage_asset_synced",
                            {
                                "device_id": socket_client.DEVICE_ID,
                                "post_id": pid,
                                "image_url": post.get("image_url") or post.get("stream_url"),
                                "asset": {"asset_id": asset_id, "name": asset_name},
                            },
                        )
            else:
                # Sync failed — retry sooner
                wait_time = 10

            # Also sync the emergency asset from server
            api.sync_emergency_asset()
        except Exception as e:
            print(f"[sync] Loop error: {e}")
            wait_time = 10

        # Sleep, but wake immediately if sync_event is set (e.g. after token handshake)
        socket_client.sync_event.wait(timeout=wait_time)
        socket_client.sync_event.clear()

if __name__ == "__main__":
    print("[mvp] Starting MVP Signage Player...")
    
    # 1. Initialize State
    media.load_playlist()
    api.load_token()
    
    # 2. Start Display Engine
    if not player.start_mpv():
        print("[mvp] Fatal: Could not start MPV. Exiting.")
        exit(1)

    # 3. Spawn Worker Threads
    threads = [
        threading.Thread(target=socket_client.socket_loop, name="SocketLoop", daemon=True),
        threading.Thread(target=socket_client.heartbeat_loop, name="HeartbeatLoop", daemon=True),
        threading.Thread(target=sync_loop, name="SyncLoop", daemon=True),
        threading.Thread(target=scheduler.scheduler_loop, name="SchedulerLoop", daemon=True),
        threading.Thread(target=sensors.sensor_loop, args=(socket_client.sio,), name="SensorLoop", daemon=True),
    ]

    for t in threads:
        t.start()
        print(f"[mvp] Started thread: {t.name}")

    print("[mvp] System ready and running")

    # 4. Monitor & Keep Alive
    try:
        while True:
            time.sleep(10)
            player.ensure_mpv_running()
    except KeyboardInterrupt:
        print("[mvp] Shutting down...")
        player.stop_mpv()
