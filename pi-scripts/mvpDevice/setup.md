# MPV-Based Raspberry Pi Device Setup

> **Template:** This guide covers setting up a headless Raspberry Pi to run the standalone MPV-based signage player. Copy the `mvpDevice/` folder, rename it (e.g. to `Device3/`), edit `config.py`, then follow these steps.

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
2. Enable SSH and configure Wi-Fi via the Imager settings (or manually create `ssh` and `wpa_supplicant.conf` on the boot partition).
3. Power on the Pi and find its IP on your network.
4. SSH in:
   ```bash
   ssh pi@<PI_IP_ADDRESS>
   ```

---

## 2. System Basics

Update and install essential tools:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl wget vim
```

Set a hostname (optional):

```bash
sudo hostnamectl set-hostname signage-mpv-1
```

---

## 3. Install MPV and Python Dependencies

```bash
sudo apt update
sudo apt install -y \
    mpv \
    python3-requests \
    python3-socketio \
    python3-serial \
    python3-setuptools
```

These are all installed via the system package manager. No `pip` or virtual environment is required.

Verify MPV works:

```bash
mpv --version
```

---

## 4. Arduino Serial Port Setup

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

Add your user to the `dialout` group:

```bash
sudo usermod -aG dialout $USER
```

Log out and back in (or reboot) for the group change to take effect.

---

## 5. Deploy the Agent Code

Transfer the copied device folder to the Pi:

```bash
# From your development machine
scp -r pi-scripts/mvpDevice/ pi@<PI_IP>:~/signage/
```

On the Pi, rename the folder and create required directories:

```bash
cd ~/signage
mv mvpDevice Device3   # or whatever name you prefer
mkdir -p Device3/downloads
mkdir -p Device3/data
cd Device3
```

Edit `config.py`:

```python
SERVER_URL = "http://YOUR_SERVER_IP:5000/api"
DEVICE_NAME = "MVP-Player-3"
LOCATION = "Main Hall"
DEVICE_ID = 3
SERIAL_PORT = "/dev/ttyUSB0"   # or /dev/ttyACM0
```

Ensure fallback assets are present:

```bash
ls -la emergency_fallback.mp4 disconnection.png no_content.png
```

---

## 6. Test the Player Manually

```bash
cd ~/signage/Device3
python3 mvp-player.py
```

Expected output:
```
[mvp] Starting MVP Signage Player...
[mvp] Started thread: SocketLoop
[mvp] Started thread: HeartbeatLoop
[mvp] Started thread: SyncLoop
[mvp] Started thread: SchedulerLoop
[mvp] Started thread: SensorLoop
[mvp] Started thread: BrightnessLoop
[mvp] System ready and running
```

MPV should open in fullscreen (black screen = idle, waiting for content).

Stop with `Ctrl+C`.

---

## 7. Auto-Start on Boot (systemd)

Copy and edit the service template:

```bash
sudo cp mvp-player.service.tpl /etc/systemd/system/mvp-player.service
sudo nano /etc/systemd/system/mvp-player.service
```

Update the paths to match your actual folder name:

```ini
[Unit]
Description=MVP Player
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/signage/Device3
Environment=PYTHONUNBUFFERED=1
ExecStart=/usr/bin/python3 /home/pi/signage/Device3/mvp-player.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mvp-player.service
sudo systemctl start mvp-player.service
```

Check status and logs:

```bash
sudo systemctl status mvp-player.service
sudo journalctl -u mvp-player.service -f
```

---

## 8. Brightness & Screen Power Control (Built-In)

**MVP handles brightness control internally.** `mvp-player.py` spawns a `BrightnessLoop` daemon thread that reads the Arduino LDR sensor and adjusts display brightness automatically. **Do not create a separate `brightness-control` systemd service** — that would create a conflicting second brightness loop.

### How It Works

Brightness and screen on/off are handled by a pluggable backend system (`display_backends.py`). You choose the controller in `config.py`:

```python
# Display controller backends (change per hardware)
# Available: "brightnessctl", "ddcutil", "xset", "noop"
BRIGHTNESS_CONTROLLER = "brightnessctl"   # controls brightness level
ONOFF_CONTROLLER = "brightnessctl"        # controls screen power on/off
```

You can mix controllers — for example `ddcutil` for brightness and `xset` for power management:

```python
BRIGHTNESS_CONTROLLER = "ddcutil"
ONOFF_CONTROLLER = "xset"
```

### Backend Options

| Backend | Brightness | Power On/Off | Hardware Requirements |
|---------|------------|--------------|----------------------|
| `brightnessctl` | `brightnessctl set {pct}%` | Sets 100% / 0% | Linux backlight device (most HDMI displays on Pi) |
| `ddcutil` | `ddcutil setvcp 10 {pct}` | `setvcp d6 01` / `d6 04` | Monitor with DDC/CI over HDMI/DP; `i2c-dev` loaded; user in `i2c` group |
| `xset` | Not supported (no-op) | `xset dpms force on/off` | X11 session running (`DISPLAY=:0`) |
| `noop` | Prints only | Prints only | Nothing — for headless testing |

### Installing Controllers

**brightnessctl (default):**
```bash
sudo apt install -y brightnessctl
```

**ddcutil (DDC/CI hardware control):**
```bash
sudo apt install -y ddcutil i2c-tools
sudo modprobe i2c-dev
sudo usermod -aG i2c $USER
# Reboot or log out for i2c group to take effect
```
Verify your monitor supports DDC/CI:
```bash
sudo ddcutil detect
```

**xset (DPMS power management):**
```bash
sudo apt install -y x11-xserver-utils
```

### Behaviour

The brightness thread:
- Reads `/tmp/signage_sensors` every 5 seconds
- **Turns the screen OFF when no motion is detected** (via `screen_off()`)
- **Turns the screen ON when motion is detected** (via `screen_on()`), then adjusts brightness based on ambient light
- Uses a 20-point hysteresis to avoid flickering
- **Emergency mode forces 100% brightness and keeps the screen on regardless of motion**

---

## 9. Local Assets

Three fallback files are expected in the device folder:

| File | Purpose |
|------|---------|
| `emergency_fallback.mp4` | Plays when emergency mode is triggered. |
| `disconnection.png` | Shows when the server is unreachable for >72 hours. |
| `no_content.png` | Placeholder when no content is assigned. |

The emergency asset is periodically synced from the server (ETag-cached). A local copy ensures offline resilience.

---

## 10. Verification Checklist

After setup, verify:

- [ ] Pi boots and MPV opens in fullscreen
- [ ] `mvp-player.service` is active (`systemctl status mvp-player`)
- [ ] Agent logs show `Serial port opened successfully`
- [ ] Heartbeat logs appear every 10s
- [ ] Arduino button press triggers emergency mode locally
- [ ] Content appears on the display after publishing from the server
- [ ] Scheduler rotates posts according to their `duration_seconds`
- [ ] Brightness controller is installed and available in PATH (`brightnessctl`, `ddcutil`, or `xset`)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Serial port error: could not open port` | Check Arduino is plugged in; verify `SERIAL_PORT` in `config.py`; ensure user is in `dialout` group. |
| `ModuleNotFoundError: No module named 'serial'` | Install via apt: `sudo apt install python3-serial` |
| `mpv: command not found` | Install via apt: `sudo apt install mpv` |
| Agent keeps reconnecting | Check `SERVER_URL` IP is correct and reachable; verify firewall allows port 5000. |
| `401 Unauthorized` in logs | Token invalid. Stop agent, delete `.device_token`, restart. |
| Black screen, no content | Check posts are published to this device; verify `downloads/` has cached files. |
| Live stream not playing | Test the stream URL manually: `mpv "http://<server>/streams/X/index.m3u8"` |
| Display stays black | Check HDMI cable; verify Pi GPU memory split (`raspi-config` → Advanced → Memory Split, set at least 128 MB). |
| `brightnessctl` not found | Install: `sudo apt install brightnessctl`. If using a different controller, update `BRIGHTNESS_CONTROLLER` in `config.py`. |
| `ddcutil` not found or fails | Install `ddcutil i2c-tools`; run `sudo modprobe i2c-dev`; add user to `i2c` group; verify with `sudo ddcutil detect`. |
| `ddcutil` permission denied | User must be in `i2c` group. Run `sudo usermod -aG i2c $USER` then reboot. |
| `xset` fails with "unable to open display" | X11 not running or `DISPLAY` not set. Ensure a GUI session is active, or use `brightnessctl` / `ddcutil` instead. |
| Screen never turns off on no motion | Check `ONOFF_CONTROLLER` in `config.py`; verify the controller command works manually. |
| Backend error on startup | Check `config.py` values for `BRIGHTNESS_CONTROLLER` and `ONOFF_CONTROLLER` match one of: `brightnessctl`, `ddcutil`, `xset`, `noop`.

---

_See `README.md` in this folder for a detailed explanation of how the agent works._
