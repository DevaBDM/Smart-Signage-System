# ~/signage/content_sync.py
import mimetypes
import os
import re
import tempfile
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from urllib.parse import urljoin

import requests

from config import ANTHIAS_URL, DEVICE_ID, SERVER_URL

REQUEST_TIMEOUT = 10
API_BASE = ANTHIAS_URL.rstrip("/")
SERVER_BASE = SERVER_URL.replace("/api", "").rstrip("/")
ASSET_ENDPOINTS = ("/api/v2/assets", "/api/v1/assets")

# Regex to find (post_id) or (post_id)-1 at the end of a name
POST_ID_PATTERN = re.compile(r"\((\d+)\)(?:-\d+)?\s*$")

def _response_text(response):
    text = response.text.strip()
    return text[:500] if text else "<empty response>"

def _asset_list(payload):
    if isinstance(payload, list): return payload
    if isinstance(payload, dict): return payload.get("results") or payload.get("assets") or []
    return []

def _asset_id(asset):
    return asset.get("asset_id") or asset.get("id")

def _ok_response(response):
    if response.text.strip():
        try: return response.json()
        except ValueError: return response.text.strip()
    return True

def anthias_request(method, path, **kwargs):
    url = f"{API_BASE}{path}"
    try:
        response = requests.request(method, url, timeout=REQUEST_TIMEOUT, **kwargs)
        if response.status_code >= 400:
            return {"ok": False, "status": response.status_code, "error": _response_text(response)}
        return {"ok": True, "status": response.status_code, "data": _ok_response(response)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def normalize_asset(asset):
    asset_id = _asset_id(asset)
    return {
        "asset_id": asset_id,
        "name": asset.get("name"),
        "uri": asset.get("uri"),
        "mimetype": asset.get("mimetype"),
        "duration": asset.get("duration"),
        "is_enabled": asset.get("is_enabled"),
        "is_active": asset.get("is_active"),
        "start_date": asset.get("start_date"),
        "end_date": asset.get("end_date"),
        "play_order": asset.get("play_order"),
    }

def get_anthias_assets():
    for endpoint in ASSET_ENDPOINTS:
        try:
            r = requests.get(f"{API_BASE}{endpoint}", timeout=REQUEST_TIMEOUT)
            if r.status_code == 404: continue
            r.raise_for_status()
            return _asset_list(r.json())
        except Exception as e:
            print(f"[content_sync] Fetch error from {endpoint}: {e}")
    return []

def list_anthias_assets():
    return [normalize_asset(asset) for asset in get_anthias_assets()]

def get_post_id_from_name(name):
    match = POST_ID_PATTERN.search(str(name or ""))
    return match.group(1) if match else None

def delete_from_anthias(asset_id):
    if not asset_id: return {"ok": False}
    print(f"[content_sync] Deleting asset {asset_id}...")
    for endpoint in ASSET_ENDPOINTS:
        try:
            r = requests.delete(f"{API_BASE}{endpoint}/{asset_id}", timeout=REQUEST_TIMEOUT)
            if r.status_code in (200, 204, 404): return {"ok": True}
        except: pass
    return {"ok": False}

def get_posts():
    try:
        r = requests.get(f"{SERVER_URL}/signage/device/{DEVICE_ID}/deployments", timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[content_sync] Deployment fetch error: {e}")
        return None

def download_image(url):
    try:
        r = requests.get(url, timeout=REQUEST_TIMEOUT, stream=True)
        r.raise_for_status()
        ext = os.path.splitext(url)[1] or ".jpg"
        fd, path = tempfile.mkstemp(suffix=ext)
        with os.fdopen(fd, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192): f.write(chunk)
        return path
    except Exception as e:
        print(f"[content_sync] Download failed {url}: {e}")
        return None

def push_to_anthias(post):
    post_id = str(post.get("post_id") or post.get("id"))
    image_path = post.get("image_url") or (post.get("images")[0].get("image_path") if post.get("images") else None)
    if not image_path: return {"ok": False, "error": "No image"}

    title = post.get("title") or f"Post {post_id}"
    asset_name = f"{title} ({post_id})"
    image_url = urljoin(f"{SERVER_BASE}/", image_path.lstrip("/"))
    
    # Check current assets
    current = get_anthias_assets()
    matches = [a for a in current if get_post_id_from_name(a.get("name")) == post_id]
    
    if matches:
        # If exactly one and looks correct, we're done
        if len(matches) == 1:
            a = matches[0]
            if a.get("name") == asset_name and not a.get("uri").startswith("http"):
                return {"ok": True, "post_id": post_id, "already_exists": True, "asset": normalize_asset(a)}
        
        # Multiple or stale: Wipe them all and re-upload to be safe
        print(f"[content_sync] Cleaning up {len(matches)} stale assets for post {post_id}...")
        for a in matches: delete_from_anthias(_asset_id(a))

    # Re-upload
    local_file = download_image(image_url)
    if not local_file: return {"ok": False, "error": "Download failed"}

    local_uri = None
    try:
        with open(local_file, 'rb') as f:
            r = requests.post(f"{API_BASE}/api/v1/file_asset", files={'file_upload': f}, timeout=20)
        if r.status_code == 200:
            try: local_uri = r.json()["uri"] if isinstance(r.json(), dict) else r.text.strip('"').strip()
            except: local_uri = r.text.strip('"').strip()
    finally:
        if os.path.exists(local_file): os.remove(local_file)

    if not local_uri: return {"ok": False, "error": "Upload failed"}

    now = datetime.now(timezone.utc)
    payload = {
        "name": asset_name, "uri": local_uri, "mimetype": "image",
        "start_date": (now - timedelta(minutes=1)).isoformat().replace("+00:00", "Z"),
        "end_date": (now + timedelta(days=3650)).isoformat().replace("+00:00", "Z"),
        "duration": str(post.get("duration_seconds") or 10),
        "is_enabled": 1, "skip_asset_check": 1
    }

    res = anthias_request("POST", "/api/v2/assets", json=payload)
    if not res.get("ok"): res = anthias_request("POST", "/api/v1/assets", json=payload)
    
    if res.get("ok"): return {"ok": True, "post_id": post_id, "asset": normalize_asset(res.get("data"))}
    return {"ok": False, "error": "Metadata registration failed"}

def sync():
    posts = get_posts()
    if posts is None: return [] # Server down

    allowed_post_ids = {str(p.get("post_id") or p.get("id")) for p in posts}
    current_assets = get_anthias_assets()
    
    # 1. NUCLEAR CLEANUP: Remove EVERYTHING not allowed OR duplicated
    post_tracker = {} # post_id -> [asset_ids]
    
    for asset in current_assets:
        aid = _asset_id(asset)
        pid = get_post_id_from_name(asset.get("name"))
        
        # If it's one of ours but not allowed anymore
        if pid and pid not in allowed_post_ids:
            print(f"[content_sync] Purging unauthorized post {pid} (Asset {aid})")
            delete_from_anthias(aid)
            continue
            
        # If it IS allowed, track it to find duplicates
        if pid:
            if pid not in post_tracker: post_tracker[pid] = []
            post_tracker[pid].append(aid)

    # 2. DEDUPLICATE: If a post has > 1 asset, kill the older ones
    for pid, aids in post_tracker.items():
        if len(aids) > 1:
            print(f"[content_sync] Found {len(aids)} assets for post {pid}. Deduplicating...")
            # Keep the last one, delete the rest
            for extra_aid in aids[:-1]:
                delete_from_anthias(extra_aid)

    # 3. PUSH: Ensure all allowed posts are actually there
    pushed = []
    for post in posts:
        res = push_to_anthias(post)
        if res.get("ok"): pushed.append(res)
    
    return pushed

def clear_all_assets():
    for a in get_anthias_assets(): delete_from_anthias(_asset_id(a))
    return {"ok": True}


def delete_asset(asset_id):
    """Delete one Anthias asset by id (socket_client `delete_asset` action)."""
    return delete_from_anthias(asset_id)


def delete_post_assets(post_id=None, image_url=None):
    """Delete every Anthias asset whose name encodes this post_id (see POST_ID_PATTERN)."""
    if post_id is None:
        return {"ok": False, "error": "Missing post_id"}
    pid = str(post_id)
    deleted = 0
    for asset in get_anthias_assets():
        if get_post_id_from_name(asset.get("name")) == pid:
            if delete_from_anthias(_asset_id(asset)).get("ok"):
                deleted += 1
    return {"ok": True, "deleted": deleted}


def set_asset_enabled(asset_id, enabled=True):
    """Hide/show an asset in the Anthias playlist without deleting it."""
    if not asset_id:
        return {"ok": False, "error": "Missing asset_id"}
    val = 1 if enabled else 0
    for path in (f"/api/v2/assets/{asset_id}", f"/api/v1/assets/{asset_id}"):
        for payload in ({"is_enabled": val}, {"is_enabled": bool(enabled)}):
            r = anthias_request("PATCH", path, json=payload)
            if r.get("ok"):
                return {"ok": True}
    return {"ok": False, "error": "Could not update is_enabled"}


def playback_control(action, asset_id=None):
    """Anthias viewer control: next, previous, or start(asset_id)."""
    if action == "next":
        cmd = "next"
    elif action == "previous":
        cmd = "previous"
    elif action == "start":
        if not asset_id:
            return {"ok": False, "error": "asset_id required"}
        cmd = f"asset&{asset_id}"
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

    for suffix in (f"/api/v2/assets/control/{cmd}", f"/api/v1/assets/control/{cmd}"):
        try:
            url = f"{API_BASE}{suffix}"
            r = requests.get(url, timeout=REQUEST_TIMEOUT)
            if r.status_code < 400:
                return {"ok": True}
        except Exception:
            pass
    return {"ok": False, "error": "Playback control request failed"}

if __name__ == "__main__":
    while True:
        try: sync()
        except Exception as e: print(f"[sync_loop] {e}")
        time.sleep(60)
