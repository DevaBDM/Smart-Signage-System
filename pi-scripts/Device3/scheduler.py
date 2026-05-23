import time
import media
import player
from config import LIVE_STREAM_DURATION

_jump_request = None  # set by socket handlers to force a post switch
_load_failures = {}   # post_id -> timestamp of last load failure
_FAILURE_COOLDOWN = 30  # seconds to skip a post after a load failure

def request_jump(post_id=None, direction=None):
    """Ask the scheduler to jump immediately."""
    global _jump_request
    if media.is_emergency():
        print("[scheduler] Jump ignored: emergency mode active")
        return
    _jump_request = {"post_id": post_id, "direction": direction}

def _duration_seconds(post):
    """Return how long this post should display."""
    if post.get("media_type") == "LIVE_STREAM":
        return post.get("duration_seconds") or LIVE_STREAM_DURATION
    return post.get("duration_seconds") or 10

def _play_post(post):
    """Tell MPV to play a post's media. Restart MPV on IPC failure and retry once."""
    path = post.get("local_path") or post.get("image_url") or post.get("stream_url")
    if not path:
        return False
    title = post.get("title", "Untitled")
    media_type = post.get("media_type", "IMAGE")

    for attempt in range(2):
        player.ensure_mpv_running()
        result = player.mpv.loadfile(path)

        if result is None:
            # IPC socket dead or unresponsive — restart MPV and retry
            print(f"[scheduler] MPV IPC unresponsive (attempt {attempt + 1}), restarting...")
            player.stop_mpv()
            time.sleep(0.5)
            if not player.start_mpv():
                print("[scheduler] MPV restart failed")
                return False
            time.sleep(0.5)
            continue

        # MPV returned a response — parse it
        error_val = result.get("error", "").lower() if isinstance(result, dict) else ""
        if error_val == "success" or error_val == "":
            player.mpv.show_text(f"{title}", 3000)
            print(f"[scheduler] Playing [{media_type}]: {title} — {path}")
            return True
        else:
            # MPV explicitly rejected the file
            print(f"[scheduler] MPV rejected file: {path} (mpv error: {error_val})")
            return False

    # Both attempts failed
    print(f"[scheduler] MPV failed to load after restart: {path}")
    return False

def scheduler_loop():
    """Background thread: rotate posts and tell MPV what to play."""
    global _jump_request
    while True:
        try:
            # Emergency mode: do nothing, let emergency video keep playing
            if media.is_emergency():
                time.sleep(1)
                continue

            # Disconnected mode: do nothing, let disconnection image stay
            if media.is_disconnected_mode():
                time.sleep(1)
                continue

            player.ensure_mpv_running()
            active = media.get_active_posts()

            if not active:
                _state, _lock = media.get_state()
                with _lock:
                    # If we were showing something other than the no-content placeholder,
                    # switch to it now. This handles emergency-end → no-content transition.
                    if _state.get("current_post", {}).get("post_id") != "__no_content__":
                        _state["current_post"] = None
                        _state["last_change"] = time.time()
                        player.play_no_content()
                        _state["current_post"] = {
                            "post_id": "__no_content__",
                            "title": "No Content",
                            "local_path": "",
                            "media_type": "IMAGE",
                            "is_enabled": True,
                        }
                time.sleep(2)
                continue

            _state, _lock = media.get_state()
            current = None
            with _lock:
                current = _state["current_post"]

            # --- Handle socket-driven jump requests ---
            jumped = False
            if _jump_request:
                req = _jump_request
                _jump_request = None
                if req.get("direction") == "next":
                    media.advance_index(len(active))
                elif req.get("direction") == "previous":
                    media.reverse_advance_index(len(active))
                elif req.get("post_id"):
                    media.set_current_idx_by_post_id(req["post_id"], active)
                with _lock:
                    _state["last_change"] = 0  # force immediate switch
                jumped = True

            elapsed = time.time() - _state["last_change"]
            expired = current is None or elapsed >= _duration_seconds(current)

            # Also advance if MPV went idle (video finished, nothing playing)
            is_idle = False
            if not expired and current and current.get("media_type") != "LIVE_STREAM":
                try:
                    if player.mpv.is_idle():
                        is_idle = True
                        expired = True
                except Exception:
                    pass

            # If only one post and already playing it (not a jump), don't reload — just reset timer.
            # Videos that go idle are allowed to loop; images just stay on screen.
            if not jumped and len(active) == 1 and current:
                only_post = active[0]
                if current.get("post_id") == only_post.get("post_id") and not is_idle:
                    with _lock:
                        _state["last_change"] = time.time()
                    time.sleep(1)
                    continue

            if expired or jumped:
                now = time.time()
                # Pick next post, skipping ones that recently failed to load
                for _ in range(len(active)):
                    idx = 0
                    with _lock:
                        idx = _state["current_idx"] % len(active) if active else 0
                        post = active[idx]

                    post_id = post.get("post_id")
                    if not jumped and post_id in _load_failures:
                        if now - _load_failures[post_id] < _FAILURE_COOLDOWN:
                            media.advance_index(len(active))
                            continue
                        else:
                            del _load_failures[post_id]

                    if _play_post(post):
                        media.set_current_post(post)
                        # Loop single videos internally; clear loop for multi-post playlists
                        if len(active) == 1 and post.get("media_type") == "VIDEO":
                            player.mpv.set_property("loop-file", "inf")
                        else:
                            player.mpv.set_property("loop-file", "no")
                        if post_id in _load_failures:
                            del _load_failures[post_id]
                        if not jumped:
                            media.advance_index(len(active))
                        break
                    else:
                        _load_failures[post_id] = now
                        print(f"[scheduler] Blacklisting post {post_id} for {_FAILURE_COOLDOWN}s")
                        media.advance_index(len(active))
                        # If this was the only active post, avoid spinning
                        if len(active) == 1:
                            time.sleep(_FAILURE_COOLDOWN)
                            break

        except Exception as e:
            print(f"[scheduler] Error: {e}")
        time.sleep(1)
