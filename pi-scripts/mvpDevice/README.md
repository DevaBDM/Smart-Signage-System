# MPV-Based Standalone Signage Player

> **Template:** Copy this entire `mvpDevice/` folder to create a new MPV-based device (e.g. `Device3/`). Edit `config.py` with your device-specific values, then run `python3 mvp-player.py`.

This agent runs on a Raspberry Pi connected to an Arduino sensor board. It uses **MPV** as the native media player, handles its own scheduling and playlist rotation, and communicates with a remote server over Socket.IO and REST.

---

## What This Agent Does

At a high level, the agent performs six continuous jobs:

1. **Keep the device identifiable and online** — sends a periodic heartbeat with device name, location, and IP.
2. **Read sensors** — listens to the Arduino over USB serial for motion, brightness, rain, and emergency-button events.
3. **Synchronize content** — pulls the current content list from the server, downloads media to a local cache, and updates the playlist.
4. **Schedule and rotate posts** — runs a scheduler loop that decides what MPV should display based on post timing, duration, and validity windows.
5. **Control MPV** — starts MPV in fullscreen idle mode and commands it via a Unix socket (`/tmp/mpv-socket`) to load images, videos, and live streams.
6. **Handle special states** — enters emergency mode when triggered (local button or remote command), and falls back to a disconnection image if the server has been unreachable for too long.

---

## Hardware Prerequisites

- Raspberry Pi (3B+, 4, or 5 recommended)
- Arduino Mega 2560 (or compatible) connected via USB
- HDMI display
- The Arduino is expected to emit packets like:
  ```
  SENSOR:motion:1,brightness:742,rain:0,emergency:0
  ```

---

## File Structure

| File | Role |
|------|------|
| `mvp-player.py` | Main orchestrator. Initializes state, starts MPV, spawns all worker threads, and monitors MPV health. |
| `media.py` | Playlist state management. Caches downloads, persists playlist to disk, tracks emergency/disconnection flags, and filters posts by active time windows. |
| `player.py` | MPV process control. Starts MPV in fullscreen idle mode with an IPC socket, sends `loadfile` and property commands, and handles emergency/disconnection/no-content playback. |
| `scheduler.py` | Post rotation loop. Decides what to play next based on elapsed duration, handles jump requests, skips failed posts temporarily, and respects emergency/disconnection states. |
| `socket_client.py` | Socket.IO client. Manages connection, handles server-originated commands (publish, clear, delete, hide/show, next/previous/start), emits heartbeats, and triggers sync on token receipt. |
| `api.py` | REST API wrapper. Fetches deployments, downloads media, syncs the emergency asset (ETag-cached), and manages the device token sidecar file. |
| `sensors.py` | Arduino serial reader. Parses `SENSOR:` packets, detects emergency button presses, forwards sensor data, and triggers local emergency playback immediately. |
| `brightness_control.py` | Optional standalone script. Reads `/tmp/signage_sensors` and adjusts display brightness with `brightnessctl`. |
| `config.py` | **Template.** Device configuration. Server URL, device identity, serial port, sync interval, asset paths, and timeouts. Edit this after copying the folder. |
| `mvp-player.service.tpl` | systemd unit template for auto-starting the agent on boot. Copy and edit paths after renaming the folder. |
| `run.py` | Optional launch shim. Use this if you prefer a shared-package model where `mvpDevice/` stays in one place and per-device folders only hold `config.py`. |

---

## How It Works

### Main Thread: `mvp-player.py`

On startup:
1. Restores the playlist from `data/playlist.json`.
2. Loads the device token from `.device_token`.
3. Starts MPV in fullscreen idle mode with `--input-ipc-server=/tmp/mpv-socket`.
4. Spawns six daemon threads:
   - **Socket loop** — maintains the Socket.IO connection.
   - **Heartbeat loop** — emits `heartbeat` every 10 seconds.
   - **Sync loop** — polls the server for deployments every 60 seconds.
   - **Scheduler loop** — rotates posts and tells MPV what to play.
   - **Sensor loop** — reads Arduino serial.
   - **Brightness loop** — adjusts screen brightness (optional).
5. Monitors MPV health every 10 seconds and restarts it if the process or IPC socket dies.

### MPV Lifecycle (`player.py`)

MPV is started once and kept running:
- Launched with `--idle`, `--fullscreen`, `--no-osc`, `--no-osd-bar`, and `--image-display-duration=inf`.
- The `MpvController` class sends JSON commands over the Unix socket at `/tmp/mpv-socket`.
- Commands include `loadfile`, `set_property` (for `loop-file`), `stop`, and `show-text`.
- If the socket becomes unresponsive, MPV is restarted automatically.

### Scheduling (`scheduler.py`)

The scheduler runs every second:
1. Skips rotation if emergency or disconnection mode is active.
2. Queries `media.get_active_posts()` for posts whose `start_date`/`end_date` window includes the current time.
3. Checks if the current post's duration has expired, or if MPV went idle (video finished).
4. Picks the next post in round-robin order, skipping any that failed to load recently.
5. Calls `player.mpv.loadfile(path)` and records the current post and timestamp.
6. Handles socket-driven jump requests (next, previous, or start a specific post).

### Content Sync (`api.py` + `mvp-player.py` sync loop)

Every 60 seconds:
1. Fetches the deployment list from `/api/signage/device/:id/deployments`.
2. For each post, downloads the media to `downloads/` (skipped for live streams).
3. Updates the local playlist via `media.update_posts()`.
4. Also syncs the emergency asset from the server using ETag to avoid redundant downloads.
5. Checks device group states — enters emergency if any group is emergency, clears if all are normal.

### Socket.IO Commands (Server → Pi)

The agent listens for server events:
- **`signage_command`** — handles actions: list, publish_asset, clear_all, delete_asset, hide_asset, show_asset, next, previous, start.
- **`playlist_update`** — same as `publish_asset`.
- **`refresh_display`** — forces MPV to reload the current media.
- **`restart_display`** — stops and restarts the MPV process.
- **`emergency_mode_start`** — sets emergency flag and plays the local emergency file.
- **`emergency_mode_end`** — checks all groups before clearing emergency, then resumes normal scheduling.

### Sensor Loop (`sensors.py`)

Opens the serial port and reads `SENSOR:` lines:
- Writes the payload to `/tmp/signage_sensors` for `brightness_control.py`.
- Detects `emergency:1` and triggers local emergency playback immediately.
- Emits `sensor_update` to the server with motion, brightness, and rain flags.
- Debounces the button so one press triggers once.

---

## Emergency & Disconnection States

Priority order:

1. **Emergency** (highest)
2. **Disconnection**
3. **Normal**

### Emergency Mode

Triggered by:
- Local Arduino button (`emergency:1` in serial packet)
- Remote `emergency_mode_start` event
- Server group state change detected during sync

While active:
- The scheduler stops rotating posts.
- MPV is forced to play `emergency_fallback.mp4` with `loop-file=inf`.
- Refresh and restart commands are blocked.
- The agent stays in emergency until **all** of its groups are cleared.

### Disconnection Mode

Triggered when the server has not been contacted successfully for longer than `DISCONNECTION_TIMEOUT_HOURS` (default 72 h).

While active:
- `media.purge_all()` clears the playlist and deletes all cached files in `downloads/`.
- MPV displays `disconnection.png` with `loop-file=inf`.
- The scheduler stops rotating posts.
- Any successful server contact resets the timer and exits this mode automatically.

---

## Brightness Control (`brightness_control.py`)

Optional standalone script that can run independently:
- Reads `/tmp/signage_sensors` (written by `sensors.py`).
- Extracts the `brightness` value (0–1023).
- Maps it to a screen brightness percentage between **5% and 100%**.
- Only applies a change if the raw value differs by more than **20** from the last applied value.
- Calls `brightnessctl set {pct}%`.
- Checks every **5 seconds**.

Requires `brightnessctl` (`sudo apt install brightnessctl`).

---

## Local Assets

| File | Purpose |
|------|---------|
| `emergency_fallback.mp4` | Plays during emergency mode. |
| `disconnection.png` | Shows when the server is unreachable for the timeout period. |
| `no_content.jpg` | Placeholder when no content is assigned. |

If `no_content.jpg` is missing, `player.py` generates a black placeholder image automatically (using PIL if available, otherwise a raw BMP).

---

## Setup

See `setup.md` in this folder for a full real-world Raspberry Pi installation guide.

---

## Troubleshooting

**MPV shows black screen / no content**
- Check `mvp-player.py` logs: `journalctl -u mvp-player.service -f`
- Check if MPV is running: `pgrep -a mpv`
- Check the IPC socket exists: `ls -la /tmp/mpv-socket`
- Try starting MPV manually: `mpv --idle --fullscreen --input-ipc-server=/tmp/mpv-socket`
- Check the server connection: the service should print `[socket] Connected to server`.
- Verify posts are published to this device and `downloads/` contains cached files.

**Live stream not playing**
- Verify the stream URL is reachable from the Pi.
- Check MPV output manually: `mpv "http://<server>/streams/X/index.m3u8"` to test the stream.

**Socket.IO not connecting**
- Check `config.py` has the correct `SERVER_URL`.
- Ensure the device token file `.device_token` exists after the first successful heartbeat.

**Emergency mode not clearing**
- The agent checks **all** of its groups via `/devices/me` before exiting emergency.
- Check logs: `journalctl -u mvp-player.service -f | grep emergency`

**Device stuck on disconnection image**
- Verify the server is reachable from the Pi: `curl -I http://<server>:5000/api`
- Any successful sync resets the 72-hour timer. Check network connectivity.
- To test without waiting 72h, temporarily set `DISCONNECTION_TIMEOUT_HOURS = 0.001` in `config.py`.
