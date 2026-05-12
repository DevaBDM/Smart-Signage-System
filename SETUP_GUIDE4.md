## Raspberry Pi Python Scripts

All scripts go inside a folder on the Pi:

```bash
mkdir -p ~/signage && cd ~/signage
```

---

## STEP 1 — Install Dependencies on the Pi

```bash
sudo apt update
sudo apt install python3-pip python3-serial -y
pip3 install requests pyserial
```

---

## STEP 2 — Config File (`config.py`)

One place to change settings across all scripts:

```python
# ~/signage/config.py

SERVER_URL   = "http://<your-server-ip>:5000/api"   # ← change this
DEVICE_NAME  = "Pi-Display-1"                        # ← unique name per Pi
LOCATION     = "Main Lobby"                          # ← where this Pi is
SERIAL_PORT  = "/dev/ttyACM0"                        # ← USB port Arduino is on
BAUD_RATE    = 9600
```

---

## STEP 3 — Heartbeat Script (`heartbeat.py`)

Registers the Pi with the server and keeps its status as `online`:

```python
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
```

---

## STEP 4 — Sensor Bridge Script (`sensor_bridge.py`)

Reads serial data from Arduino and forwards it to the server.

This expects the Arduino to send lines in this format:

```
SENSOR:proximity:1
SENSOR:light:742
SENSOR:rain:0
```

```python
# ~/signage/sensor_bridge.py
import serial, requests, time
from config import SERVER_URL, SERIAL_PORT, BAUD_RATE

def get_device_id():
    """Fetch this device's ID from the server by name."""
    from config import DEVICE_NAME
    try:
        r = requests.get(f"{SERVER_URL}/devices", timeout=5)
        for d in r.json():
            if d["name"] == DEVICE_NAME:
                return d["id"]
    except Exception as e:
        print(f"[sensor_bridge] Could not get device id: {e}")
    return None

def run():
    device_id = None
    while device_id is None:
        print("[sensor_bridge] Waiting for device registration...")
        device_id = get_device_id()
        time.sleep(5)

    print(f"[sensor_bridge] Running for device_id={device_id}")

    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
    time.sleep(2)   # wait for Arduino to reset after serial open

    while True:
        try:
            line = ser.readline().decode("utf-8").strip()
            if not line.startswith("SENSOR:"):
                continue

            # Parse  SENSOR:<type>:<value>
            _, sensor_type, value = line.split(":")
            payload = {
                "device_id":   device_id,
                "sensor_type": sensor_type,
                "value":       value,
            }
            r = requests.post(f"{SERVER_URL}/sensors/log", json=payload, timeout=5)
            print(f"[sensor_bridge] logged {sensor_type}={value} → {r.status_code}")

        except serial.SerialException as e:
            print(f"[sensor_bridge] Serial error: {e}")
            time.sleep(3)
        except Exception as e:
            print(f"[sensor_bridge] Error: {e}")

if __name__ == "__main__":
    run()
```

---

## STEP 5 — Update Your Arduino Sketch

Make sure your Arduino sends sensor data in the format the bridge expects. Add these `Serial.println` calls to your existing sketch:

```cpp
// In your Arduino loop(), after reading each sensor:

// Proximity sensor (1 = detected, 0 = not detected)
Serial.print("SENSOR:proximity:");
Serial.println(proximityValue);   // 0 or 1

// Light sensor (analog 0–1023)
Serial.print("SENSOR:light:");
Serial.println(lightValue);

// Rain sensor (1 = rain detected, 0 = dry)
Serial.print("SENSOR:rain:");
Serial.println(rainValue);        // 0 or 1

delay(2000);  // send every 2 seconds
```

---

## STEP 6 — Content Sync Script (`content_sync.py`)

Pulls the latest posts from the server and pushes them to **Anthias** via its API:

```python
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
```

---

## STEP 7 — Run Everything on Boot

Create a systemd service so all scripts start automatically when the Pi powers on:

```bash
sudo nano /etc/systemd/system/signage.service
```

Paste this:

```ini
[Unit]
Description=Smart Signage Agent
After=network.target

[Service]
WorkingDirectory=/home/pi/signage
ExecStartPre=/bin/sleep 10
ExecStart=/bin/bash -c 'python3 heartbeat.py & python3 sensor_bridge.py & python3 content_sync.py'
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable signage
sudo systemctl start signage
```

Check it's running:

```bash
sudo systemctl status signage
```

View live logs:

```bash
journalctl -u signage -f
```

---

## STEP 8 — Test the Full Flow End to End

```
1. Power on Pi
       ↓
2. signage.service starts all 3 scripts
       ↓
3. heartbeat.py  → Pi appears in Device Monitor as Online
       ↓
4. Arduino sends SENSOR data over USB
       ↓
5. sensor_bridge.py → logs appear in Sensor Logs page
       ↓
6. Admin uploads image in Content Manager → assigns to this Pi
       ↓
7. content_sync.py → image pushed to Anthias → plays on screen
```

---

## Complete System — Everything Done

| Layer                                  | Status |
| -------------------------------------- | ------ |
| Arduino sensor reading & serial output | ✅     |
| Raspberry Pi ↔ Server communication    | ✅     |
| Heartbeat & device registration        | ✅     |
| Sensor data logging                    | ✅     |
| Content sync to Anthias                | ✅     |
| Auto-start on boot                     | ✅     |
| Backend API                            | ✅     |
| Admin dashboard (all pages)            | ✅     |
| Public info feed                       | ✅     |

---

The only thing left after this is **brightness control** — the Pi adjusting display brightness based on the light sensor value coming from Arduino. Want that as the final piece?
