# ~/signage/content_sync.py
import mimetypes
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


def _response_text(response):
    text = response.text.strip()
    return text[:500] if text else "<empty response>"


def _asset_list(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("results") or payload.get("assets") or []
    return []


def _asset_id(asset):
    return asset.get("asset_id") or asset.get("id")


def _ok_response(response):
    if response.text.strip():
        try:
            return response.json()
        except ValueError:
            return response.text.strip()
    return True


def anthias_request(method, path, **kwargs):
    url = f"{API_BASE}{path}"
    response = requests.request(method, url, timeout=REQUEST_TIMEOUT, **kwargs)
    if response.status_code >= 400:
        return {
            "ok": False,
            "status": response.status_code,
            "error": _response_text(response),
        }
    return {"ok": True, "status": response.status_code, "data": _ok_response(response)}


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


def find_asset_by_name_or_uri(name, uri):
    post_id = None
    if "(" in name and ")" in name:
        post_id = name.rsplit("(", 1)[-1].split(")", 1)[0]
    for asset in get_anthias_assets():
        asset_name = asset.get("name") or ""
        asset_uri = asset.get("uri") or ""
        if asset_name == name or asset_uri == uri:
            return normalize_asset(asset)
        if post_id and f"({post_id})" in asset_name:
            return normalize_asset(asset)
    return None


def get_posts():
    try:
        r = requests.get(
            f"{SERVER_URL}/signage/device/{DEVICE_ID}/deployments",
            timeout=REQUEST_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[content_sync] Could not fetch device signage deployments: {e}")
        return None


def get_anthias_assets():
    for endpoint in ASSET_ENDPOINTS:
        try:
            r = requests.get(f"{API_BASE}{endpoint}", timeout=REQUEST_TIMEOUT)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            return _asset_list(r.json())
        except Exception as e:
            print(f"[content_sync] Could not fetch Anthias assets from {endpoint}: {e}")
    return []


def list_anthias_assets():
    return [normalize_asset(asset) for asset in get_anthias_assets()]


def build_image_url(image_path):
    if image_path.startswith(("http://", "https://")):
        return image_path
    return urljoin(f"{SERVER_BASE}/", image_path.lstrip("/"))


def image_mimetype(image_path):
    mimetype, _ = mimetypes.guess_type(image_path)
    return mimetype or "image/jpeg"


def post_key(post):
    return str(post.get("post_id") or post.get("id") or post.get("title") or "unknown")


def format_anthias_date(value, fallback):
    if value:
        return value
    return fallback.isoformat().replace("+00:00", "Z")


def post_signage_metadata(post):
    return post.get("signage_metadata") or {}


def find_assets_for_post(post_id=None, image_url=None):
    post_id = str(post_id) if post_id is not None else None
    image_url = build_image_url(image_url) if image_url else None
    matches = []
    for asset in get_anthias_assets():
        name = asset.get("name") or ""
        uri = asset.get("uri") or ""
        if post_id and f"({post_id})" in name:
            matches.append(asset)
        elif image_url and uri == image_url:
            matches.append(asset)
    return matches


def set_asset_enabled(asset_id, enabled):
    return anthias_request(
        "PATCH",
        f"/api/v2/assets/{quote(str(asset_id), safe='')}",
        json={"is_enabled": bool(enabled)},
    )


def delete_asset(asset_id):
    return anthias_request("DELETE", f"/api/v2/assets/{quote(str(asset_id), safe='')}")


def delete_post_assets(post_id=None, image_url=None):
    matches = find_assets_for_post(post_id=post_id, image_url=image_url)
    deleted = []
    errors = []
    for asset in matches:
        asset_id = _asset_id(asset)
        if not asset_id:
            errors.append({"asset": asset, "error": "Asset has no id"})
            continue
        result = delete_asset(asset_id)
        if result.get("ok"):
            deleted.append(normalize_asset(asset))
        else:
            errors.append({"asset": normalize_asset(asset), "error": result})
    return {
        "ok": len(errors) == 0,
        "deleted": deleted,
        "errors": errors,
        "matched": len(matches),
    }


def playback_control(command, asset_id=None):
    if command == "start":
        if not asset_id:
            return {"ok": False, "error": "asset_id is required for start"}
        anthias_command = f"asset&{asset_id}"
    elif command in ("next", "previous"):
        anthias_command = command
    else:
        return {"ok": False, "error": f"Unsupported playback command: {command}"}

    return anthias_request(
        "GET",
        f"/api/v2/assets/control/{quote(str(anthias_command), safe='&')}",
    )


def push_to_anthias(post):
    """Add post image as an asset in Anthias."""
    image_path = post.get("image_url")
    if not image_path and post.get("images"):
        image_path = post["images"][0].get("image_path")
    if not image_path:
        print("[content_sync] post has no image_url or images")
        return {"ok": False, "error": "post has no image_url or images"}

    title = post.get("title") or f"post-{post_key(post)}"
    image_url = build_image_url(image_path)
    metadata = post_signage_metadata(post)
    now = datetime.now(timezone.utc)
    asset_name = f"{title} ({post_key(post)})"
    existing_asset = find_asset_by_name_or_uri(asset_name, image_url)
    if existing_asset:
        print(f"[content_sync] already in Anthias: {asset_name}")
        return {
            "ok": True,
            "post_id": post.get("post_id") or post.get("id"),
            "image_url": image_path,
            "asset": existing_asset,
            "already_exists": True,
        }

    payload = {
        "name": asset_name,
        "uri": image_url,
        "start_date": format_anthias_date(
            post.get("start_date") or metadata.get("start_date"),
            now - timedelta(minutes=1),
        ),
        "end_date": format_anthias_date(
            post.get("end_date") or metadata.get("end_date"),
            now + timedelta(days=3650),
        ),
        "mimetype": image_mimetype(image_path),
        "duration": post.get("duration_seconds") or metadata.get("duration_seconds") or 10,
        "is_enabled": True,
        "nocache": True,
        "skip_asset_check": True,
    }
    for endpoint in ASSET_ENDPOINTS:
        try:
            r = requests.post(f"{API_BASE}{endpoint}", json=payload, timeout=REQUEST_TIMEOUT)
            if r.status_code == 404:
                continue
            if r.status_code in (200, 201):
                print(
                    f"[content_sync] pushed '{title}' to Anthias via {endpoint} "
                    f"-> {r.status_code}"
                )
                response_data = _ok_response(r)
                asset = normalize_asset(response_data) if isinstance(response_data, dict) else None
                if not asset or not asset.get("asset_id"):
                    asset = find_asset_by_name_or_uri(asset_name, image_url)
                return {
                    "ok": True,
                    "post_id": post.get("post_id") or post.get("id"),
                    "image_url": image_path,
                    "asset": asset
                    or {
                        "name": asset_name,
                        "uri": image_url,
                        "mimetype": payload["mimetype"],
                        "duration": payload["duration"],
                        "is_enabled": True,
                    },
                }

            print(
                f"[content_sync] Anthias rejected '{title}' via {endpoint} -> "
                f"{r.status_code}: {_response_text(r)}"
            )
            return {"ok": False, "status": r.status_code, "error": _response_text(r)}
        except Exception as e:
            print(f"[content_sync] Failed to push to Anthias via {endpoint}: {e}")
    return {"ok": False, "error": "No Anthias asset endpoint accepted the request"}


def sync():
    posts = get_posts()
    if posts is None:
        print("[content_sync] Server unreachable. Skipping sync to preserve local content.")
        return []

    post_ids_in_deployments = {str(post_key(p)) for p in posts}

    # 1. Cleanup: Remove assets from Anthias that are NO LONGER in the deployments list
    local_assets = get_anthias_assets()
    for asset in local_assets:
        asset_name = asset.get("name") or ""
        # We identify our assets by the "(post_id)" suffix in the name
        if "(" in asset_name and ")" in asset_name:
            pid_candidate = asset_name.rsplit("(", 1)[-1].split(")", 1)[0]
            if pid_candidate and pid_candidate not in post_ids_in_deployments:
                aid = _asset_id(asset)
                print(f"[content_sync] Post {pid_candidate} is no longer deployed. Removing asset {aid}...")
                delete_from_anthias(aid)

    # 2. Push: Ensure all current deployments are in Anthias
    new_count = 0
    pushed = []
    for post in posts:
        result = push_to_anthias(post)
        if result.get("ok"):
            pushed.append(result)
            if not result.get("already_exists"):
                new_count += 1

    print(f"[content_sync] Sync done. {new_count} new post(s) pushed.")
    return pushed


def delete_from_anthias(asset_id):
    """Remove asset from Anthias."""
    for endpoint in ASSET_ENDPOINTS:
        try:
            r = requests.delete(f"{API_BASE}{endpoint}/{asset_id}", timeout=REQUEST_TIMEOUT)
            if r.status_code == 404:
                continue
            if r.status_code in (200, 204):
                return {"ok": True}
        except Exception as e:
            print(f"[content_sync] Failed to delete from Anthias: {e}")
    return {"ok": False}


if __name__ == "__main__":
    while True:
        sync()
        time.sleep(60)  # check for new content every 60 seconds
