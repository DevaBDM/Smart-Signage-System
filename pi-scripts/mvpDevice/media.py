import json
import time
import threading
import requests
from pathlib import Path
from datetime import datetime, timezone
from config import CACHE_DIR, SERVER_URL, DISCONNECTION_TIMEOUT_HOURS

SCRIPT_DIR = Path(__file__).parent.resolve()
CACHE_PATH = SCRIPT_DIR / CACHE_DIR
CACHE_PATH.mkdir(exist_ok=True)
PLAYLIST_FILE = SCRIPT_DIR / "data" / "playlist.json"
PLAYLIST_FILE.parent.mkdir(exist_ok=True)

_state_lock = threading.Lock()
_state = {
    "posts": [],           # list of post dicts from server
    "current_idx": 0,      # index in the active rotation
    "last_change": 0,      # timestamp when current post started
    "current_post": None,  # the post currently on screen
    "emergency_active": False,  # True when emergency mode is active
    "disconnected_active": False,  # True when server disconnected for too long
    "last_server_contact": time.time(),  # timestamp of last successful server contact
}

def _now():
    return datetime.now(timezone.utc)

def load_playlist():
    """Restore persisted playlist on startup."""
    if PLAYLIST_FILE.exists():
        try:
            with _state_lock:
                data = json.loads(PLAYLIST_FILE.read_text())
                _state["posts"] = data.get("posts", [])
                print(f"[media] Restored {len(_state['posts'])} posts from disk")
        except Exception as e:
            print(f"[media] Failed to load playlist: {e}")

def save_playlist():
    """Persist playlist to disk."""
    try:
        with _state_lock:
            PLAYLIST_FILE.write_text(json.dumps({"posts": _state["posts"]}, indent=2))
    except Exception as e:
        print(f"[media] Failed to save playlist: {e}")

def _cached_path(url, post_id):
    """Return a local cache path for a remote URL."""
    if not url:
        return None
    if url.startswith("http"):
        ext = Path(url.split("?")[0]).suffix or ".bin"
        name = f"post_{post_id}{ext}"
        return CACHE_PATH / name
    return url

def _download(url, dest):
    """Download URL to dest, return True on success."""
    if not url or not url.startswith("http"):
        return True
    dest = Path(dest)
    if dest.exists():
        return True
    try:
        print(f"[media] Downloading {url[:80]}...")
        r = requests.get(url, timeout=120, stream=True)
        r.raise_for_status()
        dest.write_bytes(r.content)
        print(f"[media] Cached to {dest.name}")
        return True
    except Exception as e:
        print(f"[media] Download failed: {e}")
        return False

_SERVER_BASE = SERVER_URL.split("/api")[0].rstrip("/")

def _absolute_url(url):
    """Resolve relative paths like /uploads/... or /streams/... to full URLs."""
    if not url:
        return None
    if str(url).startswith("http://") or str(url).startswith("https://"):
        return url
    path = str(url).lstrip("/")
    return f"{_SERVER_BASE}/{path}"

def ensure_cached(post):
    """Download the post's media if remote, update post with local path."""
    url = post.get("image_url") or post.get("stream_url")
    if not url:
        return post
    abs_url = _absolute_url(url)
    if post.get("media_type") == "LIVE_STREAM":
        post["local_path"] = abs_url
        return post
    local = _cached_path(abs_url, post.get("post_id", 0))
    if local and _download(abs_url, local):
        post["local_path"] = str(local)
    else:
        post["local_path"] = abs_url
    return post

def update_posts(new_posts):
    with _state_lock:
        old_posts = {p.get("post_id"): p for p in _state["posts"]}
        merged = []
        for post in new_posts:
            pid = post.get("post_id")
            old = old_posts.get(pid)
            if old:
                # Preserve local_path if server didn't send one (server never does)
                if not post.get("local_path") and old.get("local_path"):
                    post["local_path"] = old["local_path"]
                # Preserve is_enabled if server didn't explicitly set it
                if post.get("is_enabled") is None:
                    post["is_enabled"] = old.get("is_enabled", True)
            if post.get("is_enabled") is None:
                post["is_enabled"] = True
            merged.append(post)
        _state["posts"] = merged
        _state["current_idx"] = 0
    save_playlist()

def add_or_update_post(post):
    if post.get("is_enabled") is None:
        post["is_enabled"] = True
    with _state_lock:
        _state["posts"] = [p for p in _state["posts"] if p.get("post_id") != post["post_id"]]
        _state["posts"].append(post)
    save_playlist()

def remove_post(post_id):
    with _state_lock:
        _state["posts"] = [p for p in _state["posts"] if p.get("post_id") != post_id]
    save_playlist()

def is_emergency():
    with _state_lock:
        return _state["emergency_active"]

def set_emergency(active):
    with _state_lock:
        _state["emergency_active"] = active

def clear_all():
    with _state_lock:
        _state["posts"] = []
        if not _state["emergency_active"] and not _state["disconnected_active"]:
            _state["current_post"] = None
    save_playlist()

# ── Disconnection timeout helpers ─────────────────────────────

def mark_server_contact():
    """Record that we successfully contacted the server."""
    with _state_lock:
        _state["last_server_contact"] = time.time()
        _state["disconnected_active"] = False

def is_disconnected_mode():
    with _state_lock:
        return _state["disconnected_active"]

def set_disconnected(active):
    with _state_lock:
        _state["disconnected_active"] = active

def check_disconnection_timeout():
    """Return True if server has been unreachable for longer than DISCONNECTION_TIMEOUT_HOURS."""
    with _state_lock:
        elapsed = time.time() - _state["last_server_contact"]
    return elapsed > (DISCONNECTION_TIMEOUT_HOURS * 3600)

def purge_all():
    """Clear all cached content, playlist, and downloaded files."""
    with _state_lock:
        _state["posts"] = []
        _state["current_idx"] = 0
        _state["current_post"] = None
    try:
        for f in CACHE_PATH.iterdir():
            if f.is_file():
                f.unlink()
        print("[media] Purged cache directory")
    except Exception as e:
        print(f"[media] Cache purge error: {e}")
    save_playlist()

def _is_active(post):
    """Check if a post should be shown right now based on its schedule."""
    now = _now()
    start = post.get("start_date")
    end = post.get("end_date")
    if start:
        try:
            val = datetime.fromisoformat(start.replace("Z", "+00:00"))
            if val > now: return False
        except Exception: pass
    if end:
        try:
            val = datetime.fromisoformat(end.replace("Z", "+00:00"))
            if val < now: return False
        except Exception: pass
    return True

def get_active_posts():
    with _state_lock:
        return [p for p in _state["posts"] if _is_active(p) and p.get("is_enabled") is not False]

def list_posts():
    """Return all posts (for 'list' command)."""
    with _state_lock:
        return list(_state["posts"])

def hide_post(post_id):
    with _state_lock:
        for p in _state["posts"]:
            if p.get("post_id") == post_id:
                p["is_enabled"] = False
                break
    save_playlist()

def show_post(post_id):
    with _state_lock:
        for p in _state["posts"]:
            if p.get("post_id") == post_id:
                p["is_enabled"] = True
                break
    save_playlist()

def reverse_advance_index(active_count):
    with _state_lock:
        if active_count > 0:
            _state["current_idx"] = (_state["current_idx"] - 1) % active_count

def set_current_idx_by_post_id(post_id, active_posts):
    """Set current_idx so the given post_id is next to play."""
    with _state_lock:
        for i, p in enumerate(active_posts):
            if p.get("post_id") == post_id:
                _state["current_idx"] = i
                return True
        return False

def get_state():
    return _state, _state_lock

def set_current_post(post):
    with _state_lock:
        _state["current_post"] = post
        _state["last_change"] = time.time()

def advance_index(active_count):
    with _state_lock:
        if active_count > 0:
            _state["current_idx"] = (_state["current_idx"] + 1) % active_count
