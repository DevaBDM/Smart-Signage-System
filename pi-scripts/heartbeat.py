# ~/signage/heartbeat.py
import requests, socket, time
from config import SERVER_URL, DEVICE_NAME, LOCATION

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    finally:
        s.close()

def send_heartbeat():
    payload = {
        "name":       DEVICE_NAME,
        "ip_address": get_ip(),
        "location":   LOCATION,
    }
    try:
        r = requests.post(f"{SERVER_URL}/devices/heartbeat", json=payload, timeout=5)
        print(f"[heartbeat] {r.status_code} — {payload['ip_address']}")
    except Exception as e:
        print(f"[heartbeat] failed: {e}")

if __name__ == "__main__":
    while True:
        send_heartbeat()
        time.sleep(30)   # ping every 30 seconds
