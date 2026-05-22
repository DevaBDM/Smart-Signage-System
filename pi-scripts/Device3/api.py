import requests
from pathlib import Path
from config import SERVER_URL, DEVICE_ID, DEVICE_TOKEN

SCRIPT_DIR = Path(__file__).parent.resolve()
TOKEN_FILE = SCRIPT_DIR / ".device_token"
_current_token = DEVICE_TOKEN or ""

def load_token():
    global _current_token
    if _current_token:
        return _current_token
    if TOKEN_FILE.exists():
        _current_token = TOKEN_FILE.read_text().strip()
    return _current_token

def save_token(token):
    global _current_token
    _current_token = token
    TOKEN_FILE.write_text(token)
    print(f"[api] Saved device token to {TOKEN_FILE}")

def get_token():
    return _current_token

def sync_deployments(ensure_cached_callback):
    """Fetch deployments from the server and update local playlist."""
    token = load_token()
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.get(
            f"{SERVER_URL}/signage/device/{DEVICE_ID}/deployments",
            headers=headers,
            timeout=30,
        )
        r.raise_for_status()
        deployments = r.json()

        new_posts = []
        for dep in deployments:
            post = {
                "post_id": dep.get("post_id"),
                "title": dep.get("title"),
                "image_url": dep.get("image_url"),
                "media_type": dep.get("media_type", "IMAGE"),
                "stream_url": dep.get("stream_url"),
                "duration_seconds": dep.get("duration_seconds"),
                "start_date": dep.get("start_date"),
                "end_date": dep.get("end_date"),
                "is_enabled": dep.get("is_enabled"),
                "priority": dep.get("priority", 1),
                "display_group": dep.get("display_group"),
                "signage_state": dep.get("signage_state"),
            }
            post = ensure_cached_callback(post)
            new_posts.append(post)

        print(f"[api] Fetched {len(new_posts)} deployments")
        return new_posts
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response else "?"
        if status == 401:
            print(f"[api] Sync denied (401) — device token invalid or missing. Waiting for Socket.IO handshake...")
        else:
            print(f"[api] Sync HTTP error {status}: {e}")
        return None
    except Exception as e:
        print(f"[api] Sync failed: {e}")
        return None
