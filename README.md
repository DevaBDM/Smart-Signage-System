# 📡 Smart Digital Signage System

A LAN-based digital content distribution and monitoring platform for university departments, offices, and campus environments. Supports image/video posts, live streaming (HLS, RTSP, YouTube, RTMP), sensor-driven brightness control, and real-time device management.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Project Structure](#project-structure)
3. [Database Setup](#database-setup)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Running the System](#running-the-system)
7. [First-Time Configuration](#first-time-configuration)
8. [Live Streaming](#live-streaming)
9. [Emergency Mode](#emergency-mode)
10. [Disconnection Timeout](#disconnection-timeout)
11. [Arduino Sensor Firmware](#arduino-sensor-firmware)
12. [Raspberry Pi Agent Setup](#raspberry-pi-agent-setup)
13. [Environment Variables Reference](#environment-variables-reference)
14. [API Reference](#api-reference)
15. [Testing](#testing)
16. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Server Machine (Windows / WSL2 / Ubuntu / Debian)

| Requirement | Version |
|-------------|---------|
| Node.js     | 20 or higher |
| npm         | 9 or higher |
| PostgreSQL  | 14 or higher |
| Python      | 3.9+ (for Pi agent) |
| ffmpeg      | 6.0+ (for stream relay) |
| yt-dlp      | latest (for YouTube Live relay) |

Install on WSL2 Arch:

```bash
sudo pacman -Syu
sudo pacman -S nodejs npm postgresql ffmpeg yt-dlp
```

Install on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib ffmpeg yt-dlp
```

On Windows: Install PostgreSQL and ffmpeg via your preferred method (scoop, winget, or manual download).

---

## Project Structure

```
WebServerSignage/
├── arduino/
│   └── sensors/
│       └── sensors.ino          ← Arduino Mega firmware (motion, brightness, rain)
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        ← Database schema (users, posts, devices, live_streams, ...)
│   ├── src/
│   │   ├── db/
│   │   │   └── prisma.js        ← Prisma client instance
│   │   ├── middleware/
│   │   │   ├── auth.js          ← JWT auth middleware
│   │   │   └── asyncHandler.js  ← Express async wrapper
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── devices.js
│   │   │   ├── groups.js
│   │   │   ├── liveStreams.js   ← Live stream CRUD + start/stop/rotate-key
│   │   │   ├── media.js
│   │   │   ├── playlists.js
│   │   │   ├── posts.js
│   │   │   ├── sensors.js
│   │   │   ├── signage.js       ← Deployments, publish, asset sync
│   │   │   ├── uploads.js
│   │   │   └── users.js
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── deploymentService.js
│   │   │   ├── deviceService.js
│   │   │   ├── liveStreamService.js
│   │   │   ├── postService.js
│   │   │   ├── signageService.js
│   │   │   ├── streamRelay/     ← HLS, RTSP, YouTube, RTMP relay engine
│   │   │   │   ├── index.js
│   │   │   │   ├── healthMonitor.js
│   │   │   │   ├── rtmpServer.js
│   │   │   │   └── youtubeRelay.js
│   │   │   └── userService.js
│   │   ├── websocket/
│   │   │   └── socket.js        ← Socket.IO server (Pi bridge, commands)
│   │   ├── utils/               ← Permissions, parsers, control locks, device checks
│   │   └── index.js             ← Entry point (bootstraps relay, RTMP server)
│   ├── tests/                   ← Jest test suites
│   ├── uploads/
│   │   └── images/              ← Uploaded media files
│   ├── scripts/                 ← Seed/check helper scripts
│   ├── .env                     ← Backend environment variables
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/                 ← Axios wrappers for every backend endpoint
│   │   │   ├── auth.js
│   │   │   ├── devices.js
│   │   │   ├── groups.js
│   │   │   ├── liveStreams.js
│   │   │   ├── media.js
│   │   │   ├── playlists.js
│   │   │   ├── posts.js
│   │   │   ├── signage.js
│   │   │   └── users.js
│   │   ├── components/
│   │   │   ├── AdminSidebar.jsx
│   │   │   ├── CreatorSidebar.jsx
│   │   │   └── FabricDesigner.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── creator/
│   │   │   │   ├── CreatorDashboard.jsx
│   │   │   │   ├── CreatorEditor.jsx
│   │   │   │   ├── CreatorLiveStreams.jsx   ← Live stream management UI
│   │   │   │   ├── CreatorPosts.jsx
│   │   │   │   └── CreatorSignage.jsx
│   │   │   └── public/
│   │   ├── socket/
│   │   │   └── socket.js        ← Socket.IO client
│   │   ├── store/
│   │   │   └── useAuthStore.js
│   │   ├── styles.js
│   │   └── App.jsx
│   ├── tests/                   ← Playwright e2e tests
│   │   ├── admin/
│   │   ├── creator/
│   │   ├── smoke/
│   │   │   └── pi-live-stream.spec.js   ← Pi/Anthias live stream smoke test
│   │   └── helpers/
│   ├── .env                     ← Frontend environment variables
│   └── package.json
│
├── pi-scripts/
│   ├── Device1/                 ← Anthias-based Pi agent
│   │   ├── config.py
│   │   ├── socket_client.py     ← Main agent (heartbeat, sensors, commands, emergency, disconnection)
│   │   ├── content_sync.py      ← Anthias asset sync + LIVE_STREAM support
│   │   ├── brightness_control.py
│   │   ├── Arduino_connection.py
│   │   ├── emergency_fallback.mp4
│   │   ├── disconnection.png
│   │   ├── socket-signage.service
│   │   └── content-sync.service
│   ├── Device2/                 ← Duplicate for second Pi
│   │   ├── (same as Device1)
│   └── Device3/                 ← Standalone MPV player (no Anthias)
│       ├── mvp-player.py        ← Main orchestrator (scheduler + sync + MPV IPC)
│       ├── media.py             ← Playlist state, caching, emergency/disconnection tracking
│       ├── player.py            ← MPV process control via Unix socket
│       ├── socket_client.py     ← Socket.IO client (commands, events)
│       ├── scheduler.py         ← Post rotation loop
│       ├── api.py               ← REST API wrapper for deployments
│       ├── sensors.py           ← Arduino serial reader
│       ├── config.py
│       ├── emergency_fallback.mp4
│       ├── disconnection.png
│       └── mvp-player.service   ← systemd unit
│
└── README.md
```

---

## Database Setup

### Step 1 — Initialize PostgreSQL

**On WSL2 Arch** (run once, first time only):

```bash
sudo -u postgres initdb --locale en_US.UTF-8 -D /var/lib/postgres/data
```

**On Windows** (run once, first time only):

```cmd
initdb -D "D:\scoop\persist\postgresql\data" --username=postgres
```

**On Ubuntu/Debian** (PostgreSQL initializes automatically on install).

### Step 2 — Start PostgreSQL

```bash
# Arch / Ubuntu / Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Windows
pg_ctl -D "D:\scoop\persist\postgresql\data" -l "D:\scoop\persist\postgresql\logfile" start
```

### Step 3 — Create Databases and User

```bash
# Linux
sudo -u postgres psql

# Windows
psql -U postgres
```

Inside the `psql` shell:

```sql
-- Create a dedicated user
CREATE USER signage_admin WITH PASSWORD 'yourpassword';

-- Production database
CREATE DATABASE signage_db OWNER signage_admin;
\c signage_db
ALTER SCHEMA public OWNER TO signage_admin;

-- Test database (for automated tests)
CREATE DATABASE signage_test OWNER signage_admin;
\c signage_test
ALTER SCHEMA public OWNER TO signage_admin;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO signage_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO signage_admin;
```

> **Note:** Replace `yourpassword` with a strong password. Use it in the backend `.env` file.

---

## Backend Setup

```bash
cd WebServerSignage/backend
npm install
```

Create `.env`:

```env
PORT=5000
DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_db"
TEST_DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
JWT_SECRET=your_super_secret_jwt_key_here
```

Run migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

Reset database (if needed):

```bash
npx prisma migrate reset
npx prisma db push
npx prisma migrate deploy
npx prisma generate
```

---

## Frontend Setup

```bash
cd WebServerSignage/frontend
npm install
npm install fabric@5.3.0 --save-exact
```

Create `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Running the System

**Terminal 1 — Backend:**

```bash
cd WebServerSignage/backend
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd WebServerSignage/frontend
npm run dev
```

The backend starts on `http://localhost:5000` and the frontend dev server on `http://localhost:5173`.

---

## First-Time Configuration

### Create the First Admin Account

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourStrongPassword123!","role":"admin"}'
```

### Create Groups and Creators

Log in as admin, then:
1. Go to **Admin → Groups** and create groups (e.g., "Computer Science", "Library")
2. Go to **Admin → Users** and create creator accounts assigned to those groups

### Register a Pi Device

1. Ensure the Pi agent (`socket_client.py`) is running and configured with your server IP
2. The Pi will auto-register as a **pending** device on first heartbeat
3. As admin, go to **Admin → Devices** and click **Approve**
4. Assign the device to a group

---

## Live Streaming

The system supports four stream types:

| Type | Source | Relay Action |
|------|--------|-------------|
| **HLS** | `https://.../index.m3u8` | Passthrough (relay_url = source_url) |
| **RTSP** | `rtsp://...` | ffmpeg transcodes to HLS |
| **YouTube Live** | YouTube URL | yt-dlp resolves manifest, then HLS passthrough |
| **RTMP Ingest** | Push to `rtmp://server:1935/live/:key` | ffmpeg transcodes to HLS |

### Creating a Live Stream

1. Log in as a **creator**
2. Go to **Creator → Live Streams**
3. Click **Create Stream** → fill title, type, and source URL
4. Click **Start** to begin the relay
5. Create a post → attach the live stream → select devices → **Publish**

The Pi will receive a `LIVE_STREAM` asset with `mimetype: webpage` and the HLS URL as the URI. Anthias will display it using its built-in webpage viewer.

### Stream Key Rotation (RTMP only)

For RTMP ingest streams, click **Rotate Key** in the Live Streams UI to invalidate the current stream key and generate a new one.

---

## Emergency Mode

Emergency mode overrides all normal content and displays an emergency asset across all devices in the affected group(s).

### Triggering Emergency Mode

| Method | Action |
|--------|--------|
| **Hardware button** | Press the emergency button wired to Arduino Pin 2. The Pi detects it via serial and triggers group-wide emergency. |
| **Admin dashboard** | Admin can set a group's signage state to `EMERGENCY`. All devices in that group enter emergency mode. |

### How it works

1. When triggered, the server broadcasts `emergency_mode_start` to all devices in the group(s).
2. Each device immediately plays its locally cached `emergency_fallback.mp4` (or image).
3. **Device1/2 (Anthias)**: The emergency asset is pushed to Anthias as the only active asset. Normal sync, refresh, restart, and playlist updates are blocked.
4. **Device3 (MPV)**: MPV is forced to play the emergency file with infinite loop. The scheduler skips all post rotation.
5. Devices check **all their groups** before exiting emergency. If any group is still in `EMERGENCY`, the device stays in emergency mode.
6. When the last group is cleared, devices exit emergency and resume normal content.

### Emergency Asset Setup

1. **Admin Dashboard** → Devices → select a device → upload an emergency asset (image or video, max 200 MB).
2. The server processes and stores it. Each Pi syncs it to `emergency_fallback.mp4` in its script directory.
3. Place a local fallback file manually if the server is unreachable.

---

## Disconnection Timeout

If a device loses contact with the server for longer than `DISCONNECTION_TIMEOUT_HOURS` (default: **72 hours / 3 days**), it automatically purges all content and displays a disconnection timeout image.

### Behavior

| Device Type | Disconnection Action |
|-------------|----------------------|
| **Device1/2 (Anthias)** | Clears all Anthias assets via `clear_all_assets()`, then registers `disconnection.png` as the only asset. |
| **Device3 (MPV)** | Purges the `downloads/` cache and playlist, then plays `disconnection.png` via MPV. Scheduler stops rotating posts. |

### Recovery

When the server comes back online:
- Any successful sync or Socket.IO heartbeat resets the disconnection timer.
- The device exits disconnection mode and resumes normal content sync automatically.

### State Priority

1. **Emergency mode** (highest) — emergency video plays
2. **Disconnection mode** — disconnection image displays
3. **Normal mode** — regular playlist rotation

---

## Arduino Sensor Firmware

**Location:** `arduino/sensors/sensors.ino`

**Hardware:**
- Arduino Mega 2560
- 3x HC-SR04 ultrasonic sensors (front, left, right) — motion/proximity detection
- 1x LDR (light dependent resistor) on `A0` — ambient brightness
- 1x Potentiometer on `A1` — rain volume simulation

**Serial Output Format:**
```
SENSOR:motion:1,brightness:742,rain:0
```

**Wiring:**
| Sensor | Pins |
|--------|------|
| Ultrasonic Front | TRIG 22, ECHO 23 |
| Ultrasonic Left | TRIG 24, ECHO 25 |
| Ultrasonic Right | TRIG 26, ECHO 27 |
| LDR | A0 |
| Rain Pot | A1 |

Flash the `.ino` to the Arduino Mega, then connect it to the Pi via USB.

---

## Raspberry Pi Agent Setup

### Supported Device Types

| Device | Player Engine | Entry Point | Use Case |
|--------|--------------|-------------|----------|
| **Device1 / Device2** | Anthias (web viewer) | `socket_client.py` | Standard signage with Anthias asset management |
| **Device3** | MPV (native media player) | `mvp-player.py` | Standalone player without Anthias — see `pi-scripts/Device3/README.md` |

### Install Dependencies

**Device1/2 (Anthias):**
```bash
sudo apt update
sudo apt install python3-pip python3-serial -y
pip3 install requests pyserial python-socketio[client] websocket-client
```

**Device3 (MPV):**
```bash
sudo apt update
sudo apt install -y mpv python3-requests python3-python-socketio python3-serial python3-setuptools
```

### Configure the Agent

Edit `pi-scripts/Device1/config.py` (or `Device2`, `Device3`):

```python
SERVER_URL = "http://YOUR_SERVER_IP:5000/api"   # ← your backend IP
ANTHIAS_URL = "http://localhost"                 # Anthias runs on the Pi (Device1/2 only)
DEVICE_NAME = "Pi-Display-1"
LOCATION = "Floor 1"
SERIAL_PORT = "/dev/ttyUSB0"                     # or /dev/ttyACM0 for real Arduino
BAUD_RATE = 9600
DEVICE_ID = 1                                      # ← must match the approved device ID in DB
DEVICE_TOKEN = ""                                  # auto-populated after first registration

# Emergency & disconnection assets (all devices)
EMERGENCY_FALLBACK = os.path.join(os.path.dirname(__file__), "emergency_fallback.mp4")
DISCONNECTION_IMAGE = os.path.join(os.path.dirname(__file__), "disconnection.png")
DISCONNECTION_TIMEOUT_HOURS = 72                   # purge content after 72h of no server contact
```

> **Important:** After approving the Pi in the web UI, note the assigned `DEVICE_ID` and update `config.py`.

### Start the Agent

**Device1/2:**
```bash
cd pi-scripts/Device1
python3 socket_client.py
```

**Device3:**
```bash
cd pi-scripts/Device3
python3 mvp-player.py
```

The main script starts background threads:
- **Heartbeat** — every 10s (registers device, keeps online status)
- **Sensor loop** — reads Arduino serial, forwards to server
- **Content sync** — every 60s, pulls deployments and syncs assets
- **Socket.IO events** — handles emergency mode, refresh, restart, signage commands

### Auto-Start on Boot (systemd)

**Device1/2:**
```bash
sudo cp pi-scripts/Device1/socket-signage.service /etc/systemd/system/
sudo cp pi-scripts/Device1/content-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable socket-signage.service
sudo systemctl start socket-signage.service
```

**Device3:**
```bash
sudo cp pi-scripts/Device3/mvp-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mvp-player.service
sudo systemctl start mvp-player.service
```

> **Note:** `content-sync.service` is optional for Device1/2 because `socket_client.py` already runs the content sync loop internally.

---

## Environment Variables Reference

### Backend `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | HTTP server port (default: 5000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string for production |
| `TEST_DATABASE_URL` | Yes | PostgreSQL connection string for tests |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `STREAMS_DIR` | No | Directory for HLS segment storage (default: `./streams`) |
| `RTMP_PORT` | No | RTMP server port (default: 1935) |
| `HTTP_PORT` | No | RTMP HTTP server port (default: 8000) |

### Frontend `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API base URL (e.g., `http://localhost:5000/api`) |

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register first admin or new user |
| POST | `/api/auth/login` | Login, returns JWT token |
| GET | `/api/auth/me` | Get current user profile |

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | List posts (scoped by user role/group) |
| POST | `/api/posts` | Create post (with optional live_stream_id) |
| PUT | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |

### Live Streams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/live-streams` | List live streams |
| POST | `/api/live-streams` | Create live stream |
| PUT | `/api/live-streams/:id` | Update live stream |
| DELETE | `/api/live-streams/:id` | Delete live stream |
| POST | `/api/live-streams/:id/start` | Start relay |
| POST | `/api/live-streams/:id/stop` | Stop relay |
| POST | `/api/live-streams/:id/rotate-key` | Rotate RTMP stream key |

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List devices |
| POST | `/api/devices/register` | Register a new device |
| POST | `/api/devices/:id/approve` | Approve pending device |
| GET | `/api/devices/me` | Device-authenticated settings (token required) |
| PUT | `/api/devices/:id` | Update device settings |
| DELETE | `/api/devices/:id` | Remove device |
| POST | `/api/devices/:id/emergency-asset` | Upload emergency asset (image/video, max 200 MB) |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| PUT | `/api/groups/:id` | Update group (includes `signage_state`: `NORMAL` or `EMERGENCY`) |
| DELETE | `/api/groups/:id` | Remove group |

### Signage

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signage/publish` | Publish post to device(s) |
| GET | `/api/signage/devices/:id/assets` | List Anthias assets for device |
| GET | `/api/signage/device/:id/deployments` | Device pull endpoint (Pi polls this) |

---

## Testing

### Backend Tests (Jest)

```bash
cd backend
npm test
```

**Test suites:**
- `deviceAuth.test.js` — Device authentication and token lifecycle
- `liveStreams.crud.test.js` — Live stream CRUD + key rotation
- `smoke.test.js` — End-to-end smoke tests
- `streamRelay.lifecycle.test.js` — Relay start/stop/bootstrap/prune (8 tests)
- `userService.priority.test.js` — User role priority logic
- `youtubeRelay.test.js` — YouTube URL resolution and refresh timer

**Total: 50 tests**

### Frontend E2E Tests (Playwright)

```bash
cd frontend
npx playwright install  # one-time
```

Run all tests:
```bash
npx playwright test --reporter=line
```

Run specific suites:
```bash
# Admin flows
npx playwright test tests/admin/ --reporter=line

# Creator flows (posts, live streams, editor)
npx playwright test tests/creator/ --reporter=line

# Pi/Anthias live stream smoke test
npx playwright test tests/smoke/pi-live-stream.spec.js --reporter=line
```

The smoke test auto-starts a test backend on port 5001. Do **not** run your real backend on that port when executing smoke tests.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `permission denied for schema public` | Run `GRANT ALL PRIVILEGES ON SCHEMA public TO signage_admin;` |
| `EADDRINUSE :::8000` (RTMP port conflict) | Another backend instance is running. Stop it first, or set `HTTP_PORT` in `.env` |
| `Fabric SyntaxError` | Ensure `fabric@5.3.0` is installed: `npm ls fabric` |
| Vite cache issues | `npm run dev -- --force` |
| Pi not appearing in device list | Check `SERVER_URL` in `config.py` matches the backend IP; verify firewall |
| Live stream not showing on Pi | Check Pi can reach the HLS URL; verify `allowed_on_signage: true` on the post |
| Anthias asset sync fails | Check Anthias is running (`docker ps`); verify `ANTHIAS_URL` in `config.py` |
| Emergency mode not clearing after admin resets | Admin must clear **all** groups the device belongs to. Device checks every group via `/devices/me` before exiting emergency. |
| Device stuck on disconnection image | Verify the server is reachable from the Pi. Any successful sync or heartbeat resets the 72-hour timer. |
| Tests fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Run with `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"` (Windows) or `NODE_TLS_REJECT_UNAUTHORIZED=0` (Linux) |

---

_Smart Digital Signage System — Built for university campus environments._
