# ~/signage/content_sync.py
import requests, time
from config import SERVER_URL, DEVICE_NAME, DEVICE_ID

ANTHIAS_URL = "http://localhost"  # Anthias runs locally on the Pi


def get_device():
    try:
        r = requests.get(f"{SERVER_URL}/devices", timeout=5)
        for d in r.json():
            if d.get("id") == DEVICE_ID or d.get("device_name") == DEVICE_NAME:
                return d
    except Exception as e:
        print(f"[content_sync] Could not fetch device: {e}")
    return None


def get_posts():
    try:
        r = requests.get(f"{SERVER_URL}/posts", timeout=5)
        return [p for p in r.json() if p.get("publish_to_signage") and p.get("images")]
    except Exception as e:
        print(f"[content_sync] Could not fetch posts: {e}")
        return []


def get_anthias_assets():
    try:
        r = requests.get(f"{ANTHIAS_URL}/api/v1/assets", timeout=5)
        return r.json()
    except:
        return []


def push_to_anthias(post):
    """Add post image as an asset in Anthias."""
    image_path = post.get("image_url")
    if not image_path and post.get("images"):
        image_path = post["images"][0].get("image_path")
    if not image_path:
        print("[content_sync] post has no image_url or images")
        return

    title = post.get("title") or f"post-{post.get('post_id', 'unknown')}"
    image_url = f"{SERVER_URL.replace('/api', '')}{image_path}"
    payload = {
        "name": title,
        "uri": image_url,
        "mimetype": "image",
        "duration": post.get("duration_seconds", 10),
        "is_active": True,
        "is_enabled": True,
    }
    try:
        r = requests.post(f"{ANTHIAS_URL}/api/v1/assets", json=payload, timeout=10)
        print(f"[content_sync] pushed '{title}' -> {r.status_code}")
    except Exception as e:
        print(f"[content_sync] Failed to push to Anthias: {e}")


def sync():
    posts = get_posts()
    anthias_assets = get_anthias_assets()
    existing_names = {a["name"] for a in anthias_assets}

    new_count = 0
    for post in posts:
        title = post.get("title") or f"post-{post.get('id', 'unknown')}"
        if title not in existing_names:
            push_to_anthias(post)
            new_count += 1

    print(f"[content_sync] Sync done. {new_count} new post(s) pushed.")


if __name__ == "__main__":
    while True:
        sync()
        time.sleep(60)  # check for new content every 60 seconds
