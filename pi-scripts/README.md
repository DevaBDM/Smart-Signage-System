# Raspberry Pi Agent Scripts

These Python scripts run on each Raspberry Pi display unit. They handle device registration, sensor reading from Arduino, content sync with Anthias, and real-time command reception from the backend server.

---

## Per-Device Structure

Each Pi has its own folder (e.g., `Device1/`, `Device2/`):

```
Device1/
├── config.py                   ← Server IP, device name, serial port, device ID
├── socket_client.py            ← MAIN ENTRY POINT (heartbeat, sensors, commands, content sync)
├── content_sync.py             ← Anthias asset sync (images, videos, LIVE_STREAM webpages)
├── brightness_control.py       ← Auto-brightness via xrandr (reads sensor file)
├── Arduino_connection.py       ← Standalone serial test script
├── socket-signage.service      ← systemd service for socket_client.py
└── content-sync.service        ← systemd service for standalone content_sync.py
```

> **Note:** `content_sync.py` is already called by `socket_client.py` internally. You only need `content-sync.service` if you want to run content sync standalone.

---

## Setup Steps

### 1. Install Python Dependencies

```bash
sudo apt update
sudo apt install python3-pip python3-serial -y
pip3 install requests pyserial python-socketio[client] websocket-client
```

### 2. Configure `config.py`

Edit the config file for your device:

```python
SERVER_URL = "http://YOUR_SERVER_IP:5000/api"   # ← your backend IP address
ANTHIAS_URL = "http://localhost"                  # Anthias runs locally on the Pi
DEVICE_NAME = "Pi-Display-1"
LOCATION = "Floor 1"
SERIAL_PORT = "/dev/ttyUSB0"                     # Arduino USB port (try /dev/ttyACM0 if needed)
BAUD_RATE = 9600
DEVICE_ID = 1                                      # ← must match approved device ID in DB
DEVICE_TOKEN = ""                                  # auto-populated after first registration
```

**Finding the correct serial port:**
```bash
# List USB serial devices
ls /dev/ttyUSB* /dev/ttyACM*

# Or watch the kernel log when plugging in the Arduino
sudo dmesg | tail -20
```

### 3. Start the Agent

```bash
cd ~/signage/Device1
python3 socket_client.py
```

This starts three background threads:
- **Heartbeat** — registers device, keeps online status (every 10s)
- **Sensor loop** — reads Arduino serial, forwards motion/brightness/rain to server
- **Content sync** — pulls deployments from server, syncs assets to Anthias (every 60s)

### 4. Approve the Device in the Web UI

1. Open the admin dashboard at `http://<server-ip>:5173`
2. Log in as admin → go to **Admin → Devices**
3. Find the pending device (it auto-registered via heartbeat)
4. Click **Approve** and assign it to a group
5. Note the `DEVICE_ID` and update `config.py` if needed
6. Restart the agent: `Ctrl+C`, then `python3 socket_client.py`

### 5. Auto-Start on Boot (systemd)

Copy and edit the service file:

```bash
# Copy service file
sudo cp ~/signage/Device1/socket-signage.service /etc/systemd/system/

# Edit paths to match your actual directory
sudo nano /etc/systemd/system/socket-signage.service
```

Update these lines in the service file:
```ini
[Service]
WorkingDirectory=/home/pi/signage/Device1
ExecStart=/usr/bin/python3 /home/pi/signage/Device1/socket_client.py
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable socket-signage.service
sudo systemctl start socket-signage.service

# Check status
sudo systemctl status socket-signage.service

# View logs
sudo journalctl -u socket-signage.service -f
```

---

## Scripts Overview

| Script | Purpose | Runs Automatically? |
|--------|---------|---------------------|
| `socket_client.py` | Main agent: Socket.IO, heartbeat, sensors, commands, content sync | Yes (run this) |
| `content_sync.py` | Anthias API integration: downloads media, uploads assets, handles LIVE_STREAM | Called by socket_client |
| `brightness_control.py` | Reads sensor file, adjusts screen brightness via xrandr | Optional (run separately) |
| `Arduino_connection.py` | Standalone serial test (useful for debugging) | Manual only |

---

## LIVE_STREAM Support

When a post with a live stream is published to this device:

1. The Pi pulls the deployment from `/api/signage/device/:id/deployments`
2. `content_sync.py` detects `media_type == "LIVE_STREAM"`
3. Instead of downloading/uploading media, it registers a **webpage** asset in Anthias
4. The webpage URI is the HLS stream URL (`stream_url` or `image_url`)
5. Anthias displays the live stream using its built-in webpage viewer

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `SerialException: could not open port` | Check `SERIAL_PORT` in `config.py`; verify Arduino is connected (`ls /dev/ttyUSB*`) |
| Pi not showing in admin device list | Check `SERVER_URL` IP is correct; verify no firewall blocks port 5000 |
| `socket_client.py` keeps reconnecting | Server may be down, or token is invalid. Delete `.device_token` and restart |
| Anthias assets not syncing | Check Anthias is running: `docker ps`; verify `ANTHIAS_URL` |
| Brightness control not working | Requires X11 display (`DISPLAY=:0`). May not work in headless/docker setups |
| Content sync shows "Server down" | Backend is unreachable. Check network and `SERVER_URL` |

---

_See the root `README.md` for full server setup instructions._
