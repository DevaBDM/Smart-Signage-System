# Anthias Device — Real-World Raspberry Pi Setup

This guide covers setting up a **headless Raspberry Pi** (no GUI) to run the Anthias-based device agent. The Pi connects to an Arduino sensor board over USB and drives a display via Anthias.

---

## Hardware

- **Raspberry Pi** (3B+, 4, or 5 recommended)
- **MicroSD card** (16 GB minimum, 32 GB recommended)
- **Arduino Mega 2560** (or compatible) with sensor firmware flashed
- **USB cable** to connect Arduino to Pi
- **Display** (HDMI monitor or TV) connected to the Pi
- **Network** — Ethernet or Wi-Fi

---

## 1. Raspberry Pi OS Installation

1. Flash **Raspberry Pi OS Lite (64-bit)** to the SD card using Raspberry Pi Imager.
2. Before first boot, enable SSH and configure Wi-Fi (if needed) via the Imager settings, or create `ssh` and `wpa_supplicant.conf` files on the boot partition manually.
3. Insert the SD card, power on the Pi, and find its IP on your network.
4. SSH in:
   ```bash
   ssh pi@<PI_IP_ADDRESS>
   ```

---

## 2. System Basics

Update the system and install essential tools:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl wget vim
```

Set a hostname (optional but recommended for multiple Pis):

```bash
sudo hostnamectl set-hostname signage-pi-1
```

---

## 3. Anthias Installation

Anthias runs the display content. Install it on the Pi:

```bash
bash <(curl -sL https://install-anthias.srly.io)
```

Follow the interactive prompts. After installation:
- Anthias runs as a Docker container.
- The web dashboard is available at `http://<PI_IP>`.
- The Pi display should show the Anthias default screen.

Verify Anthias is running:

```bash
docker ps
```

---

## 4. Python Agent Dependencies

Install the Python libraries the agent needs using the system package manager:

```bash
sudo apt update
sudo apt install -y python3-requests python3-serial python3-socketio python3-websocket
```

These are the Debian/Ubuntu package equivalents of the Python modules used by the agent. They install into the global system Python so no virtual environment or `pip` is required.

---

## 5. Arduino Serial Port Setup

When the Arduino is plugged into the Pi via USB, it appears as a serial device (usually `/dev/ttyUSB0` or `/dev/ttyACM0`).

### Find the port

```bash
ls /dev/ttyUSB* /dev/ttyACM*
```

If nothing appears, check the kernel log:

```bash
sudo dmesg | tail -20
```

### Permissions

Add your user to the `dialout` group so the agent can open the serial port without root:

```bash
sudo usermod -aG dialout $USER
```

Log out and back in (or reboot) for the group change to take effect.

### Update config

Edit your per-device `config.py` and set the correct serial port:

```python
SERIAL_PORT = "/dev/ttyUSB0"   # or /dev/ttyACM0
```

---

## 6. Brightness Control (Optional)

If your display supports DDC/CI or the Pi has a backlight interface, install `brightnessctl`:

```bash
sudo apt install -y brightnessctl
```

The `brightness_control.py` script reads the LDR value from `/tmp/signage_sensors` and adjusts screen brightness automatically.

Test it manually:

```bash
python3 brightness_control.py
```

---

## 7. Deploy the Agent Code

Transfer the `pi-scripts/anthiasDevice/` folder to the Pi:

```bash
# From your development machine
scp -r pi-scripts/anthiasDevice/ pi@<PI_IP>:~/signage/
```

On the Pi, create your per-device folder and config:

```bash
mkdir -p ~/signage/Device1
cd ~/signage/Device1
```

Create `config.py`:

```python
import os
from config_defaults import *

DEVICE_ID = 1
DEVICE_NAME = "Pi-Display-1"
LOCATION = "Floor 1"
SERIAL_PORT = "/dev/ttyUSB0"
SERVER_URL = "http://YOUR_SERVER_IP:5000/api"
```

Create `run.py`:

```python
import sys, os
_device_dir = os.path.dirname(__file__)
_shared_dir = os.path.join(_device_dir, "..", "anthiasDevice")
sys.path.insert(0, os.path.abspath(_shared_dir))

from socket_client import main
if __name__ == "__main__":
    main()
```

Test the agent manually:

```bash
cd ~/signage/Device1
python3 run.py
```

You should see:
- `Serial port opened successfully`
- `heartbeat` messages every 10 seconds
- Sensor data lines if the Arduino is connected

Stop with `Ctrl+C`.

---

## 8. Auto-Start on Boot (systemd)

Create a systemd service so the agent starts automatically:

```bash
sudo nano /etc/systemd/system/socket-signage.service
```

Paste:

```ini
[Unit]
Description=Smart Signage Socket Agent
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/signage/Device1
ExecStart=/usr/bin/python3 /home/pi/signage/Device1/run.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> If using a venv, change `ExecStart` to:
> ```ini
> ExecStart=/home/pi/signage-venv/bin/python /home/pi/signage/Device1/run.py
> ```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable socket-signage.service
sudo systemctl start socket-signage.service
```

Check status and logs:

```bash
sudo systemctl status socket-signage.service
sudo journalctl -u socket-signage.service -f
```

---

## 9. Optional: Auto-Start Brightness Control

If you want brightness control as a separate service:

```bash
sudo nano /etc/systemd/system/brightness-control.service
```

```ini
[Unit]
Description=Signage Brightness Control
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/signage/anthiasDevice
ExecStart=/usr/bin/python3 /home/pi/signage/anthiasDevice/brightness_control.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable brightness-control.service
sudo systemctl start brightness-control.service
```

---

## 10. Fallback Assets

Make sure these files exist in your per-device folder (or in `anthiasDevice/`):

| File | Purpose |
|------|---------|
| `emergency_fallback.mp4` | Plays when emergency mode is triggered. |
| `disconnection.png` | Shows when the server is unreachable for >72 hours. |
| `no_content.png` | Optional placeholder when no content is deployed. |

The agent syncs the emergency asset from the server periodically, but a local copy ensures it works even offline.

---

## 11. Verification Checklist

After setup, verify:

- [ ] Pi boots to Anthias display
- [ ] `socket-signage.service` is active (`systemctl status socket-signage`)
- [ ] Agent logs show `Serial port opened successfully`
- [ ] Heartbeat logs appear every 10s
- [ ] Arduino button press triggers emergency mode locally
- [ ] Content appears on the display after publishing from the server
- [ ] `brightnessctl` works if brightness control is enabled

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Serial port error: could not open port` | Check Arduino is plugged in; verify `SERIAL_PORT` in `config.py`; ensure user is in `dialout` group. |
| `ModuleNotFoundError: No module named 'serial'` | Install via apt: `sudo apt install python3-serial` |
| Agent keeps reconnecting | Check `SERVER_URL` IP is correct and reachable; verify firewall allows port 5000. |
| `401 Unauthorized` in logs | Token invalid. Stop agent, delete `.device_token`, restart. |
| Anthias not showing content | Verify Anthias is running (`docker ps`); check `ANTHIAS_URL` in config. |
| Display stays black | Check HDMI cable; verify Pi GPU memory split (`raspi-config` → Advanced → Memory Split, set at least 128 MB). |

---

_See `README.md` in this folder for a deep dive into how the agent works._
