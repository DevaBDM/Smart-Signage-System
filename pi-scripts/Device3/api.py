import requests
from pathlib import Path
from config import SERVER_URL, DEVICE_ID, DEVICE_TOKEN, EMERGENCY_FALLBACK

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


def fetch_device_settings():
    """Fetch this device's settings from the server (including emergency_asset_path)."""
    token = load_token()
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.get(
            f"{SERVER_URL}/devices/{DEVICE_ID}",
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[api] Failed to fetch device settings: {e}")
        return None


def download_file(url, dest, timeout=120):
    """Download a remote file to a local path."""
    try:
        r = requests.get(url, timeout=timeout, stream=True)
        r.raise_for_status()
        Path(dest).parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"[api] Download failed for {url}: {e}")
        return False


def sync_emergency_asset(fallback_path=EMERGENCY_FALLBACK):
    """Check server for emergency_asset_path and download it locally if needed."""
    device = fetch_device_settings()
    if not device:
        return False
    asset_url = device.get("emergency_asset_path")
    if not asset_url:
        return False
    # Convert relative paths to absolute URLs
    if asset_url.startswith("/"):
        base = SERVER_URL.split("/api")[0].rstrip("/")
        asset_url = base + asset_url
    # Only download if changed or missing
    import hashlib
    import os
    remote_hash = None
    try:
        hr = requests.head(asset_url, timeout=10)
        remote_etag = hr.headers.get("etag", "")
    except Exception:
        remote_etag = ""
    local_etag_file = str(Path(fallback_path).with_suffix(".etag"))
    local_etag = ""
    if os.path.exists(local_etag_file):
        with open(local_etag_file, "r") as f:
            local_etag = f.read().strip()
    if remote_etag and remote_etag == local_etag and os.path.exists(fallback_path):
        return True  # Already up to date
    print(f"[api] Downloading emergency asset: {asset_url}")
    if download_file(asset_url, fallback_path):
        if remote_etag:
            with open(local_etag_file, "w") as f:
                f.write(remote_etag)
        print(f"[api] Emergency asset cached to {fallback_path}")
        return True
    return False
