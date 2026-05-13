# ~/signage/content_sync.py
import mimetypes
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

import requests

from config import ANTHIAS_URL, SERVER_URL

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


def get_posts():
    try:
        r = requests.get(f"{SERVER_URL}/posts", timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        return [p for p in r.json() if p.get("publish_to_signage") and p.get("images")]
    except Exception as e:
        print(f"[content_sync] Could not fetch posts: {e}")
        return []


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


def push_to_anthias(post):
    """Add post image as an asset in Anthias."""
    image_path = post.get("image_url")
    if not image_path and post.get("images"):
        image_path = post["images"][0].get("image_path")
    if not image_path:
        print("[content_sync] post has no image_url or images")
        return False

    title = post.get("title") or f"post-{post_key(post)}"
    image_url = build_image_url(image_path)
    metadata = post_signage_metadata(post)
    now = datetime.now(timezone.utc)
    payload = {
        "name": f"{title} ({post_key(post)})",
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
                return True

            print(
                f"[content_sync] Anthias rejected '{title}' via {endpoint} -> "
                f"{r.status_code}: {_response_text(r)}"
            )
            return False
        except Exception as e:
            print(f"[content_sync] Failed to push to Anthias via {endpoint}: {e}")
    return False


def sync():
    posts = get_posts()
    anthias_assets = get_anthias_assets()
    existing_names = {a.get("name") for a in anthias_assets if a.get("name")}

    new_count = 0
    for post in posts:
        title = post.get("title") or f"post-{post_key(post)}"
        asset_name = f"{title} ({post_key(post)})"
        if asset_name not in existing_names:
            if push_to_anthias(post):
                existing_names.add(asset_name)
                new_count += 1
        else:
            print(f"[content_sync] already in Anthias: {asset_name}")

    print(f"[content_sync] Sync done. {new_count} new post(s) pushed.")


if __name__ == "__main__":
    while True:
        sync()
        time.sleep(60)  # check for new content every 60 seconds
