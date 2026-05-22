# MVP Player — Standalone Signage Player

This is a **self-contained signage player** that runs directly on a Raspberry Pi without Anthias.
It receives posts from the server, schedules them, and displays them via **MPV** (a command-line media player).

## What it does

- **Scheduling**: Automatically cycles through published posts based on `start_date`, `end_date`, and `duration_seconds`.
- **Media types**: Images, videos, and live streams (HLS/YouTube via server proxy).
- **Time management**: Only shows posts that are currently within their valid time window.
- **Auto-start**: Runs as a systemd service that starts on boot.
- **Server sync**: Talks to the server via the same Socket.IO + REST API as Device1/Device2.

## Architecture

```
┌─────────────┐     Socket.IO     ┌─────────────────┐
│   Server    │◄─────────────────►│   Device3 (Pi)  │
│  (port 5000)│    REST API       │                 │
└─────────────┘                   │  ┌─────────────────┐  │
                                  │  │  mvp-player.py  │  │
                                  │  │  (Python        │  │
                                  │  │   scheduler +   │  │
                                  │  │   server sync)  │  │
                                  │  └────────┬────────┘  │
                                  │           │ IPC       │
                                  │  ┌────────▼────────┐  │
                                  │  │      MPV        │  │
                                  │  │  (fullscreen    │  │
                                  │  │   display)      │  │
                                  │  └─────────────────┘  │
                                  └───────────────────────┘
```

## Setup

### 1. Copy files to the Pi

```bash
# On the Pi
mkdir -p /media/signageScript
cd /media/signageScript

# Copy these files from the repo:
#   config.py
#   mvp-player.py
#   requirements.txt
```

### 2. Edit config.py

```python
SERVER_URL = "http://<YOUR_SERVER_IP>:5000/api"   # e.g., http://192.168.1.100:5000/api
DEVICE_NAME = "MVP-Player-3"
LOCATION = "Main Hall"
DEVICE_ID = 3
```

> **Device ID**: You must first create this device in the admin dashboard (or use an existing device ID).

### 3. Install dependencies via APT (Debian 12/13)

For a dedicated signage device, install dependencies globally via `apt` instead of `pip`:

```bash
sudo apt update
sudo apt install -y \
    mpv \
    python3-requests \
    python3-python-socketio \
    python3-serial \
    python3-setuptools
```

> **Why apt instead of pip?** Debian 12/13 blocks pip in externally managed environments. Using apt gives you pre-compiled binaries, automatic security updates, and lower storage usage (no duplicate venv libraries).

### 4. Test the player

```bash
python3 mvp-player.py
```

You should see:
```
[mvp] Restored X posts from disk
[mpv] Starting MPV...
[mpv] IPC socket ready at /tmp/mpv-socket
[socket] Connected to server
```

MPV should open in fullscreen on the Pi's display (black screen = idle).

### 5. Install the systemd service (auto-start on boot)

```bash
sudo cp mvp-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mvp-player.service
sudo systemctl start mvp-player.service
```

Check status:
```bash
sudo systemctl status mvp-player.service
```

### 6. MPV is installed via apt

MPV was already installed in step 3. It stays open in fullscreen idle mode and `mvp-player.py` tells it what to play via a Unix socket at `/tmp/mpv-socket`.

## How it works with the server

1. **Admin publishes a post** to Device3 via the dashboard.
2. The server sends a `signage_command` with `action: "publish_asset"` to Device3 via Socket.IO.
3. Device3 receives the post, **downloads the media** to `downloads/`, and adds it to its local playlist.
4. The **scheduler** checks every second what should be on screen based on time and duration.
5. **MPV** plays the media fullscreen. Images stay on screen for `duration_seconds`, videos play to end (or duration), live streams play continuously.
6. If Device3 was offline, it **polls the server every 60 seconds** to sync the full deployment list.

## File structure

```
/media/signageScript/
├── mvp-player.py                  # Main script (MPV controller + scheduler + sync)
├── config.py                  # Device config
├── requirements.txt           # Python deps
├── mvp-player.service     # systemd unit
├── data/
│   └── playlist.json          # Persisted playlist state
├── downloads/                 # Cached media files
│   ├── post_24.webp
│   └── post_25.mp4
└── .device_token              # Server auth token (auto-generated)
```

## Differences from Device1/Device2

| Feature | Device1/2 (Anthias) | Device3 (MVP Player) |
|---------|--------------------|----------------------|
| Display engine | Anthias (web viewer) | MPV (native media player) |
| Scheduling | Anthias handles it | Python scheduler |
| Media caching | Anthias downloads | Python downloads to `downloads/` |
| Time management | Anthias | Built-in scheduler |
| Live streams | Via Anthias | Direct HLS playback in MPV |
| Content sync | `content_sync.py` | Built into `mvp-player.py` |

## Troubleshooting

**MPV shows black screen / no content**
- Check that posts are published to this device in the admin dashboard.
- Check `mvp-player.py` logs: `journalctl -u mvp-player.service -f`
- Check if MPV is running: `pgrep -a mpv`
- Check the IPC socket exists: `ls -la /tmp/mpv-socket`
- Try starting MPV manually: `mpv --idle --fullscreen --input-ipc-server=/tmp/mpv-socket`
- Check the server connection: the service should print `[socket] Connected to server`.

**Live stream not playing**
- Verify the stream's `relay_url` is reachable from the Pi.
- Check MPV output manually: `mpv "http://<server>/streams/X/index.m3u8"` to test the stream.
- Ensure the server is proxying the stream (the URL should be `http://<server>/streams/X/index.m3u8`).

**Socket.IO not connecting**
- Check `config.py` has the correct `SERVER_URL`.
- Ensure the device is approved in the admin dashboard.
- Check that the `.device_token` file was created after the first successful heartbeat.

## Reboot command

```bash
sudo systemctl restart mvp-player.service
```
