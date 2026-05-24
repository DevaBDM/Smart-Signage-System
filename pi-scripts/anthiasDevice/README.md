# Anthias-Based Raspberry Pi Device Agent

This package runs on a Raspberry Pi connected to an Arduino sensor board. It manages content playback via **Anthias** (a digital signage player), reads environmental and proximity sensors from the Arduino, handles emergency/disconnection fallback states, and keeps itself synchronized with a remote server.

---

## What This Agent Does

At a high level, the agent performs four continuous jobs:

1. **Keep the device identifiable and online** — sends a periodic heartbeat with device name, location, and IP.
2. **Read sensors** — listens to the Arduino over USB serial for motion, brightness, rain, and emergency-button events.
3. **Synchronize content** — pulls the current content list from the server and mirrors it into Anthias, downloading media and registering assets as needed.
4. **Handle special states** — enters an emergency mode when triggered (local button or remote command), and falls back to a disconnection image if the server has been unreachable for too long.

---

## Hardware Prerequisites

- Raspberry Pi (running Anthias in Docker)
- Arduino Mega 2560 (or compatible) connected via USB
- The Arduino is expected to emit packets like:
  ```
  SENSOR:motion:1,brightness:742,rain:0,emergency:0
  ```

---

## File Structure

| File | Role |
|------|------|
| `socket_client.py` | Main orchestrator. Runs three background threads (heartbeat, sensor, content sync) and manages the Socket.IO connection. |
| `content_sync.py` | Talks to Anthias over its REST API. Downloads media, uploads files, registers image/video/webpage assets, and cleans up stale ones. |
| `brightness_control.py` | Optional standalone script. Reads the latest sensor brightness value and adjusts the Pi display with `brightnessctl`. |
| `Arduino_connection.py` | Standalone serial test / debug utility. Prints Arduino lines to stdout and ACKs back. |
| `config_defaults.py` | Default constants: server URL, Anthias URL, serial port, baud rate, asset paths, token path, and disconnection timeout (default 72 h). |
| `config.py` | **Per-device override template.** Imports defaults and overrides `DEVICE_ID`, `DEVICE_NAME`, `LOCATION`, `SERIAL_PORT`, and `SERVER_URL`. |
| `run.py` | Launch shim. Adds `../anthiasDevice` to `sys.path`, then starts `socket_client.main()`. Copied into each per-device folder. |
| `socket-signage.service.tpl` | systemd unit template for auto-starting the main agent. |

---

## Configuration

The agent uses a two-tier config:

1. **`config_defaults.py`** holds shared values.
2. **A per-device `config.py`** imports those defaults and overrides only the host-specific fields:
   ```python
   from config_defaults import *
   DEVICE_ID = 1
   DEVICE_NAME = "Pi-Display-1"
   LOCATION = "Floor 1"
   SERIAL_PORT = "/dev/ttyUSB0"
   SERVER_URL = "http://192.168.56.1:5000/api"
   ```

When `run.py` executes, `sys.path` points to the shared `anthiasDevice/` package, but the working directory is the per-device folder, so `from config import ...` resolves to the local override first.

---

## How It Works

### Main Thread: Socket.IO Connection

`socket_client.py` starts three daemon threads, then enters a reconnect loop:

- Builds the base URL from `SERVER_URL` (strips `/api`).
- If a device token has been saved to disk, it is sent as Socket.IO auth.
- On connect, the agent is live. If the connection drops, it retries every 5 seconds.

### Thread 1: Heartbeat

Every **10 seconds**, the agent emits a `heartbeat` event containing:
- `device_id`, `device_name`, `location`
- Local IP address (probed by opening a UDP socket to 8.8.8.8:80)
- Status: `"online"`

If the server does not know this device yet, it may reply with a `device_token` event. The agent saves that token to a sidecar file (`.device_token`) and uses it for subsequent authenticated requests.

### Thread 2: Sensor Loop

The sensor loop opens the serial port (`SERIAL_PORT` at `BAUD_RATE`, default 9600) and reads lines from the Arduino.

For every `SENSOR:` line:
1. The payload is written to `/tmp/signage_sensors` so other local scripts (e.g. `brightness_control.py`) can read it without touching serial.
2. The payload is parsed into key-value pairs.
3. **Emergency button detection:** if `emergency:1` and not already triggered, the agent:
   - Sets its internal emergency flag.
   - Emits `emergency_trigger` to the server (if connected).
   - Immediately pushes the local `emergency_fallback.mp4` to Anthias.
   When the button is released (`emergency:0`), the trigger is reset so it can fire again.
4. **Regular sensor forwarding:** if the Socket.IO connection is up, the agent emits a `sensor_update` with:
   - `motion` — boolean (any ultrasonic sensor < 100 cm)
   - `brightness` — raw 0–1023 LDR value
   - `rain` — boolean (potentiometer >= 500 threshold)

If the serial port cannot be opened, the loop retries every 5 seconds.

### Thread 3: Content Sync Loop

Every **60 seconds**, the agent attempts to keep Anthias in sync with the server's current content list for this device.

Before normal sync, it performs safety checks:

- **Disconnection timeout:** If the server has been unreachable for longer than `DISCONNECTION_TIMEOUT_HOURS` (default 72 h), the agent enters disconnection mode. It clears all Anthias assets and registers the local `disconnection.png` as the only asset. Any successful server contact later resets the timer and exits this mode.
- **Emergency mode:** Normal content sync is skipped while emergency mode is active.

If conditions are normal, it calls `content_sync.sync()`, which:

1. Fetches the current deployment list for this `DEVICE_ID`.
2. **Cleans up:** Removes Anthias assets that are no longer in the deployment list, plus any orphan/manual assets.
3. **Deduplicates:** If a post has more than one asset in Anthias, all but the newest are deleted.
4. **Pushes missing content:** For each post in the deployment list, it ensures a matching Anthias asset exists.
   - **Images / Videos:** Downloaded from the server, uploaded to Anthias via its file API, then registered with metadata (name, duration, dates, enabled state).
   - **Live Streams:** Skips download/upload. Registers a `webpage` asset in Anthias pointing directly to the HLS stream URL.

After syncing content, the agent also syncs the **emergency asset** from the server:
- It fetches the device's own settings.
- If an emergency asset URL is returned, it downloads it to `emergency_fallback.mp4`.
- It uses HTTP `ETag` to avoid re-downloading an unchanged file.

Finally, it checks the device's group states. If any group is in emergency, the agent enters emergency mode locally; if all groups are normal, it clears emergency mode.

### Socket.IO Commands (Server → Pi)

The agent listens for several server-originated events:

- **`playlist_update`** — pushes new content to Anthias. Blocked during emergency mode.
- **`refresh_display`** — sends `pkill -HUP anthias` to force Anthias to refresh. Blocked during emergency.
- **`restart_display`** — restarts the Anthias systemd service. Blocked during emergency.
- **`emergency_mode_start`** — sets the internal emergency flag and pushes the local emergency asset to Anthias immediately.
- **`emergency_mode_end`** — queries the server for all groups this device belongs to. Only clears emergency if **every** group is normal, preventing premature exit when multiple groups are involved.
- **`signage_command`** — executes local Anthias actions: list assets, clear all, publish asset, delete asset, hide/show asset, playback control (next/previous/start).

---

## Content Sync Details (`content_sync.py`)

`content_sync.py` is the layer between the agent and Anthias. It does not run continuously by itself; it is invoked by `socket_client.py` inside the content sync loop.

### Supported Media Types

| Type | Anthias `mimetype` | Handling |
|------|-------------------|----------|
| Image | `image` | Downloaded, uploaded to Anthias file API, registered as asset. |
| Video | `video` | Same as image; Anthias duration is set to `0` so it uses the native clip length. |
| Live Stream | `webpage` | No download. Registered as a webpage asset with the stream URL as `uri`. |

### Anthias API Compatibility

The sync layer tries Anthias API versions in fallback order: **v2 → v1.2 → v1**. This allows the agent to work with different Anthias releases without manual version pinning.

### Asset Naming

Assets are named with an embedded post ID so the sync loop can match them later:
```
"Post Title (42)"
```
A regex extracts the ID for deduplication and cleanup.

---

## Emergency & Disconnection States

The agent maintains two independent safety states with this priority:

1. **Emergency** (highest)
2. **Disconnection**
3. **Normal**

### Emergency Mode

Triggered by:
- Local Arduino button (`emergency:1` in serial packet)
- Remote `emergency_mode_start` event
- Server group state change detected during sync

While active:
- The local `emergency_fallback.mp4` (or image) is pushed to Anthias as the only active asset.
- Content sync, playlist updates, refresh, and restart are blocked.
- The agent stays in emergency until **all** of its groups are cleared.

### Disconnection Mode

Triggered when the server has not been contacted successfully for longer than `DISCONNECTION_TIMEOUT_HOURS`.

While active:
- All Anthias assets are cleared.
- The local `disconnection.png` is registered as the only asset.
- Normal content sync is skipped.
- Any successful heartbeat or sync resets the timer and exits this mode automatically.

---

## Brightness Control (`brightness_control.py`)

This is an optional, standalone script that can run independently of the main agent.

- Reads `/tmp/signage_sensors` (written by `socket_client.py`).
- Extracts the `brightness` value (0–1023).
- Maps it to a screen brightness percentage between **5% and 100%**.
- Only applies a change if the raw value differs by more than **20** from the last applied value, preventing flicker.
- Calls `brightnessctl set {pct}%`.
- Checks every **5 seconds**.

Requires `brightnessctl` to be installed (`sudo apt install brightnessctl`).

---

## Arduino Test Utility (`Arduino_connection.py`)

A small standalone script for debugging the serial link:

- Opens `SERIAL_PORT` at `BAUD_RATE`.
- Prints every `SENSOR:` line received.
- Detects `emergency:1` and prints an alert.
- Sends `ACK from Pi\n` back to the Arduino for each line.
- Gracefully closes the port on Ctrl+C.

Use this to verify wiring and packet format before running the full agent.

---

## Running the Agent

### Manual Start

From a per-device folder that contains `config.py` and `run.py`:

```bash
cd ~/signage/Device1
python3 run.py
```

### Auto-Start on Boot (systemd)

1. Copy the service template and edit paths:
   ```bash
   sudo cp socket-signage.service.tpl /etc/systemd/system/socket-signage.service
   sudo nano /etc/systemd/system/socket-signage.service
   ```
2. Update `WorkingDirectory` and `ExecStart` to point to your per-device folder.
3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable socket-signage.service
   sudo systemctl start socket-signage.service
   ```

---

## Local Assets

Three fallback files are expected alongside the config or in the shared `anthiasDevice/` folder:

| File | Purpose |
|------|---------|
| `emergency_fallback.mp4` | Plays during emergency mode. Can be an image or video (up to ~200 MB). |
| `disconnection.png` | Static image shown when the server has been unreachable for the timeout period. |
| `no_content.jpg` | Optional placeholder when no content is assigned. |

The emergency asset is also periodically updated from the server (ETag-cached) so the local file stays current.

---

## Logs & Debugging

View real-time logs when running under systemd:

```bash
sudo journalctl -u socket-signage.service -f
```

Common log signatures and what they mean:

| Log | Meaning |
|-----|---------|
| `Serial port opened successfully` | Arduino handshake OK. |
| `Serial port error: ... retrying in 5s` | Arduino disconnected or wrong `SERIAL_PORT`. |
| `heartbeat` | Emitted every 10 s while Socket.IO is connected. |
| `EMERGENCY BUTTON DETECTED` | Local button pressed; local asset pushed, server notified. |
| `Server unreachable for >72 hours` | Disconnection mode entered. |
| `Server back online` | Disconnection mode cleared after successful server contact. |
| `Skipping normal sync: emergency mode active` | Content sync paused because emergency is engaged. |
| `401 Unauthorized — clearing token` | Token rejected; agent will re-authenticate on next heartbeat. |
