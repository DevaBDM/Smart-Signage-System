# ~/signage/content_sync.py
import requests, time
from config import SERVER_URL, DEVICE_NAME

ANTHIAS_URL = "http://localhost:8080"   # Anthias runs locally on the Pi

def get_device():
    try:
        r = requests.get(f"{SERVER_URL}/devices", timeout=5)
        for d in r.json():
            if d["name"] == DEVICE_NAME:
                return d
    except Exception as e:
        print(f"[content_sync] Could not fetch device: {e}")
    return None

def get_posts(device_id):
    try:
        r = requests.get(f"{SERVER_URL}/posts", timeout=5)
        return [p for p in r.json() if p["target_device_id"] == device_id]
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
    image_url = f"{SERVER_URL.replace('/api', '')}{post['image_url']}"
    payload = {
        "name":       post["title"],
        "uri":        image_url,
        "mimetype":   "image",
        "duration":   10,           # seconds to display
        "is_active":  True,
        "is_enabled": True,
    }
    try:
        r = requests.post(f"{ANTHIAS_URL}/api/v1/assets", json=payload, timeout=10)
        print(f"[content_sync] pushed '{post['title']}' → {r.status_code}")
    except Exception as e:
        print(f"[content_sync] Failed to push to Anthias: {e}")

def sync():
    device = get_device()
    if not device:
        print("[content_sync] Device not registered yet.")
        return

    posts         = get_posts(device["id"])
    anthias_assets = get_anthias_assets()
    existing_names = {a["name"] for a in anthias_assets}

    new_count = 0
    for post in posts:
        if post["title"] not in existing_names:
            push_to_anthias(post)
            new_count += 1

    print(f"[content_sync] Sync done. {new_count} new post(s) pushed.")

if __name__ == "__main__":
    while True:
        sync()
        time.sleep(60)   # check for new content every 60 seconds
