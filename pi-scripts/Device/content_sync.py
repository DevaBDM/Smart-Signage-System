# ~/signage/content_sync.py
import os
import re
import tempfile
import time
import traceback
from datetime import datetime, timedelta, timezone
import requests

from config import ANTHIAS_URL, DEVICE_ID, SERVER_URL, DEVICE_TOKEN, TOKEN_FILE


def _device_token():
    """Return the current bearer token from config or the sidecar file."""
    if DEVICE_TOKEN:
        return DEVICE_TOKEN
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            return f.read().strip()
    return ""

REQUEST_TIMEOUT = 10
MEDIA_DOWNLOAD_TIMEOUT = 300
API_BASE = ANTHIAS_URL.rstrip("/")
SERVER_BASE = SERVER_URL.replace("/api", "").rstrip("/")
ASSET_ENDPOINTS = ("/api/v2/assets", "/api/v1.2/assets", "/api/v1/assets")

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
        headers = {}
        token = _device_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        r = requests.get(
            f"{SERVER_URL}/signage/device/{DEVICE_ID}/deployments",
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[content_sync] Deployment fetch error: {e}")
        return None

def media_absolute_url(image_path):
    """Build a fetchable URL for /uploads/... paths (no urljoin footguns)."""
    if not image_path:
        return None
    path = str(image_path).strip()
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = SERVER_BASE.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def download_media(url, timeout=MEDIA_DOWNLOAD_TIMEOUT):
    try:
        r = requests.get(url, timeout=timeout, stream=True)
        r.raise_for_status()
        ext = os.path.splitext(url.split("?")[0])[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov", ".m4v"):
            ext = ".mp4" if "video" in (r.headers.get("Content-Type") or "") else ".jpg"
        fd, path = tempfile.mkstemp(suffix=ext)
        size = 0
        with os.fdopen(fd, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    size += len(chunk)
        if size < 1:
            if os.path.exists(path):
                os.remove(path)
            print(f"[content_sync] Download empty body from {url}")
            return None
        return path
    except Exception as e:
        print(f"[content_sync] Download failed {url}: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"[content_sync] HTTP {e.response.status_code}: {e.response.text[:200]}")
        return None

download_image = download_media


def anthias_mimetype(image_path, is_video):
    """Anthias expects 'video' | 'image' | 'webpage', not video/mp4."""
    if is_video:
        return "video"
    return "image"


def upload_file_to_anthias(local_file):
    """Upload media to Anthias; returns local uri string or None."""
    size = os.path.getsize(local_file) if os.path.exists(local_file) else 0
    timeout = max(120, min(600, int(size / 40000) + 60))

    for endpoint in ("/api/v2/file_asset", "/api/v1/file_asset"):
        try:
            with open(local_file, "rb") as f:
                r = requests.post(
                    f"{API_BASE}{endpoint}",
                    files={"file_upload": (os.path.basename(local_file), f)},
                    timeout=timeout,
                )
            if r.status_code >= 400:
                print(
                    f"[content_sync] Anthias upload {endpoint} HTTP {r.status_code}: "
                    f"{r.text[:400]}"
                )
                continue
            try:
                data = r.json()
            except ValueError:
                return r.text.strip().strip('"')
            if isinstance(data, dict):
                uri = data.get("uri") or data.get("url")
                if uri:
                    print(f"[content_sync] Anthias file uploaded via {endpoint} -> {uri}")
                    return uri
            text = r.text.strip().strip('"')
            if text:
                print(f"[content_sync] Anthias file uploaded via {endpoint} -> {text}")
                return text
        except Exception as e:
            print(f"[content_sync] Anthias upload {endpoint} error: {e}")
    return None


def register_anthias_asset(payload):
    """Create asset metadata in Anthias v2 then v1."""
    res = anthias_request("POST", "/api/v2/assets", json=payload)
    if res.get("ok"):
        return res
    print(f"[content_sync] v2 asset create failed: {res.get('error')}")

    payload_v12 = {
        "name": payload["name"],
        "uri": payload["uri"],
        "mimetype": payload["mimetype"],
        "start_date": payload["start_date"],
        "end_date": payload["end_date"],
        "duration": str(payload["duration"]),
        "is_enabled": 1,
    }
    res = anthias_request("POST", "/api/v1.2/assets", json=payload_v12)
    if res.get("ok"):
        return res
    print(f"[content_sync] v1.2 asset create failed: {res.get('error')}")

    # v1 API uses integer flags and omits v2-only fields (e.g. ext).
    payload_v1 = {
        "name": payload["name"],
        "uri": payload["uri"],
        "mimetype": payload["mimetype"],
        "start_date": payload["start_date"],
        "end_date": payload["end_date"],
        "duration": payload["duration"],
        "is_enabled": 1,
        "skip_asset_check": 1,
    }
    payload_v1["duration"] = str(payload_v1["duration"])
    return anthias_request("POST", "/api/v1/assets", json=payload_v1)


def push_to_anthias(post):
    post_id = str(post.get("post_id") or post.get("id"))
    image_path = post.get("image_url") or (post.get("images")[0].get("image_path") if post.get("images") else None)
    if not image_path: return {"ok": False, "error": "No media"}
    media_type = (post.get("media_type") or "IMAGE").upper()
    is_video = media_type == "VIDEO" or image_path.lower().endswith((".mp4", ".webm", ".mov", ".m4v"))
    is_live = media_type == "LIVE_STREAM"

    title = post.get("title") or f"Post {post_id}"
    asset_name = f"{title} ({post_id})"
    image_url = media_absolute_url(image_path)
    if not image_url:
        return {"ok": False, "error": "No media URL"}

    # --- LIVE STREAM: skip download/upload, register as webpage ---
    if is_live:
        try:
            stream_url = post.get("stream_url") or image_url
            # Anthias needs an absolute URL; relay_url may be a relative path
            if stream_url and not (stream_url.startswith("http://") or stream_url.startswith("https://")):
                abs_url = media_absolute_url(stream_url)
                if abs_url:
                    stream_url = abs_url

            # Check for existing live stream assets to avoid duplicates
            current = get_anthias_assets()
            matches = [a for a in current if get_post_id_from_name(a.get("name")) == post_id]
            if matches:
                if len(matches) == 1 and matches[0].get("uri") == stream_url:
                    return {
                        "ok": True,
                        "post_id": post_id,
                        "already_exists": True,
                        "asset": normalize_asset(matches[0]),
                        "image_url": stream_url,
                    }
                # Stale or mismatched: wipe and re-register
                print(f"[content_sync] Cleaning up {len(matches)} stale live assets for post {post_id}...")
                for a in matches:
                    delete_from_anthias(_asset_id(a))

            now = datetime.now(timezone.utc)
            duration = int(post.get("duration_seconds") or 3600)
            start_dt = post.get("start_date")
            end_dt = post.get("end_date")
            start_date = start_dt if start_dt else (now - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
            end_date = end_dt if end_dt else (now + timedelta(days=3650)).isoformat().replace("+00:00", "Z")
            payload = {
                "name": asset_name,
                "uri": stream_url,
                "mimetype": "webpage",
                "start_date": start_date,
                "end_date": end_date,
                "duration": duration,
                "is_enabled": True,
                "skip_asset_check": True,
            }
            priority = post.get("priority")
            if priority is not None:
                payload["play_order"] = int(priority)
            print(f"[content_sync] Registering LIVE stream asset '{asset_name}' (webpage, {duration}s)")
            res = register_anthias_asset(payload)
            if res.get("ok"):
                raw = res.get("data")
                asset = normalize_asset(raw if isinstance(raw, dict) else {})
                print(f"[content_sync] Live asset registered: {asset.get('asset_id')}")
                return {"ok": True, "post_id": post_id, "asset": asset, "image_url": stream_url}
            err = res.get("error") or "Live stream registration failed"
            print(f"[content_sync] Live asset registration failed: {err}")
            return {"ok": False, "error": err}
        except Exception as e:
            print(f"[content_sync] LIVE STREAM EXCEPTION: {e}")
            traceback.print_exc()
            return {"ok": False, "error": str(e)}

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
    print(f"[content_sync] Downloading {image_url} ...")
    local_file = download_media(image_url)
    if not local_file:
        return {"ok": False, "error": f"Download failed: {image_url}"}

    try:
        local_uri = upload_file_to_anthias(local_file)
    finally:
        if os.path.exists(local_file):
            os.remove(local_file)

    if not local_uri:
        return {"ok": False, "error": "Anthias file upload failed"}

    now = datetime.now(timezone.utc)
    mimetype = anthias_mimetype(image_path, is_video)
    clip_seconds = int(post.get("duration_seconds") or 10)
    # Anthias v2: video duration must be 0 (uses native video length); images use slide time.
    duration = 0 if is_video else clip_seconds
    start_dt = post.get("start_date")
    end_dt = post.get("end_date")
    start_date = start_dt if start_dt else (now - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
    end_date = end_dt if end_dt else (now + timedelta(days=3650)).isoformat().replace("+00:00", "Z")
    payload = {
        "name": asset_name,
        "uri": local_uri,
        "mimetype": mimetype,
        "start_date": start_date,
        "end_date": end_date,
        "duration": duration,
        "is_enabled": True,
        "skip_asset_check": True,
    }
    priority = post.get("priority")
    if priority is not None:
        payload["play_order"] = int(priority)
    if is_video and image_path.lower().endswith(".mp4"):
        payload["ext"] = "mp4"

    if is_video:
        print(
            f"[content_sync] Registering asset '{asset_name}' "
            f"({mimetype}, anthias duration=0, clip={clip_seconds}s)"
        )
    else:
        print(f"[content_sync] Registering asset '{asset_name}' ({mimetype}, {duration}s)")
    res = register_anthias_asset(payload)
    if res.get("ok"):
        raw = res.get("data")
        asset = normalize_asset(raw if isinstance(raw, dict) else {})
        print(f"[content_sync] Asset registered: {asset.get('asset_id')}")
        return {
            "ok": True,
            "post_id": post_id,
            "asset": asset,
            "image_url": image_path,
        }

    err = res.get("error") or "Metadata registration failed"
    print(f"[content_sync] Asset registration failed: {err}")
    return {"ok": False, "error": err}

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

        # Orphan/manual upload not managed by the server — purge when server has active deployments
        if not pid and allowed_post_ids:
            print(f"[content_sync] Purging orphan/manual asset {aid} ({asset.get('name')})")
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
        if res.get("ok"):
            pushed.append(res)
        else:
            pid = post.get("post_id") or post.get("id")
            print(f"[content_sync] Sync skipped post {pid}: {res.get('error')}")
    
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
