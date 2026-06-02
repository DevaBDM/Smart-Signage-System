# Chapter 4 {.title}

# System Design and Implementation

This chapter presents the complete design and implementation of the
Smart Digital Signage System. We describe the hardware layer with our
real Arduino sensor bridge, the network and infrastructure design, the
backend system with authentication and concurrency control, the frontend
user interface, the dual player architecture, and the security
implementation. This chapter demonstrates that our system is not merely
a design but a working prototype with validated hardware and software
components.

## Hardware Implementation

### Component Selection and Specifications

We selected the components for our prototype based on cost,
availability, and capability. Table 4.1 lists the specifications and pin
assignments for each component.

<caption>Component specifications and Arduino pin assignments.</caption>
| Component | Specification | Arduino Pin | Purpose |
|----|----|----|----|
| Arduino Mega 2560 | ATmega2560 @ 16 MHz, 256 KB flash, 8 KB SRAM, 54 digital I/O | \- | Sensor acquisition and preprocessing |
| HC-SR04 (×3) | 2–400 cm range, 40 kHz burst, 5 V, \<2 mA quiescent | D22–D27 (TRIG/ECHO per sensor) | Motion and proximity detection |
| LDR module | Photoresistor + 10 kΩ divider, 0–1023 analog output | A0 | Ambient light sensing |
| Potentiometer | 10 kΩ linear | A1 | Simulated weather/rain input |
| Emergency button | Push button, 10 kΩ pull-down | D2 | Hardware emergency trigger |
| Debian laptop | Intel/AMD x86_64, 4 GB+ RAM, Debian 13 live USB | USB-B (to Arduino) | Simulated Raspberry Pi edge node |
| Laptop screen | 15.6” LCD, 1920×1080 | HDMI (internal) | Digital signage display |


We selected the Arduino Mega 2560 rather than the Uno because the Mega
provides 54 digital I/O pins and 16 analog inputs, giving us sufficient
headroom for three HC-SR04 sensors (each requiring one TRIG and one ECHO
pin) plus the LDR, potentiometer, and emergency button. The Mega’s four
hardware UARTs also provide flexibility for future expansion.

We used laptops running Debian 13 live USB sessions to simulate
Raspberry Pi 4B edge nodes. Debian 13 provides the same systemd, Python
3, and network stack that would be available on a Raspberry Pi OS
installation, allowing us to validate all software components before
physical Pi deployment. The laptop screens served as the digital signage
displays.

### Physical Assembly and Wiring

We assembled the sensor bridge on a solderless breadboard following a
nine-step procedure:

- **Mount sensors:** We placed the three HC-SR04 sensors on the
  breadboard with their ultrasonic transducers facing outward. Sensor 1
  (left) and Sensor 3 (right) were angled 45° outward to maximize
  horizontal coverage. Sensor 2 (center) was mounted perpendicular to
  the display plane.

- **Connect power rails:** We ran 5 V and ground rails along the
  breadboard edges, using 22 AWG jumper wires. The Arduino’s 5 V pin can
  supply up to 400 mA, which is sufficient for all sensors combined (~50
  mA peak).

- **Wire HC-SR04 sensors:** Each sensor received VCC to the 5 V rail,
  GND to the ground rail, TRIG to a digital output pin (D22, D24, D26),
  and ECHO to a digital input pin (D23, D25, D27). We added 1 kΩ series
  resistors on the ECHO lines as a precaution against voltage mismatch,
  though the Arduino Mega 2560’s 5 V logic is fully compatible.

- **Connect LDR module:** We connected the LDR module’s VCC to 5 V, GND
  to ground, and the analog output to pin A0.

- **Connect potentiometer:** We wired the potentiometer’s outer
  terminals to 5 V and ground, and the wiper to pin A1.

- **Connect emergency button:** We wired the push button between pin D2
  and 5 V, with a 10 kΩ pull-down resistor to ground on D2. This
  configuration ensures the pin reads LOW when the button is open and
  HIGH when pressed.

- **USB connection:** We connected the Arduino to the Debian laptop via
  a USB A-to-B cable. The cable provides both serial communication and
  power (up to 500 mA).

- **Verification:** We performed a continuity check between 5 V and GND
  to confirm no short circuits. We verified sensor orientation
  (transducers facing outward) and checked that the HDMI output on the
  laptop was active.

<figure>
<img src="./assets/media/image9.jpeg"
style="width:5.83333in;height:2.72157in" />
<figcaption><p>Photograph of our assembled prototype showing the Arduino
Mega 2560 on a solderless breadboard with three HC-SR04 sensors,
connected via USB to a Debian 13 laptop.</p></figcaption>
</figure>

<img src="./assets/media/image10.png"
style="width:3.19613in;height:2.75725in"
alt="Fig 4.2 — Sensor wiring schematic showing Arduino Mega pin assignments for HC-SR04 (D22–D27), LDR (A0), potentiometer (A1), and emergency button (D2)." /><img src="./assets/media/image11.png"
style="width:3.32207in;height:3.458in" />

Sensor wiring schematic showing Arduino Mega pin assignments for HC-SR04
(D22–D27), LDR (A0), potentiometer (A1), and emergency button (D2).

### Sensor Fusion and Preprocessing

We wrote the Arduino firmware (`sensors.ino`) to run a deterministic 2
Hz main loop. Each iteration reads all sensors, computes derived values,
and transmits a formatted packet over USB CDC serial at 9600 baud.

- **HC-SR04 distance measurement:** For each sensor, the firmware drives
  the TRIG pin HIGH for 10 µs to initiate an 8-pulse 40 kHz ultrasonic
  burst. It then measures the ECHO pulse duration using `pulseIn()` with
  a 30 ms timeout. The distance in centimeters is computed as
  `d = (t_echo × 0.0343) / 2`, where the speed of sound is 343 m/s at
  20°C.

- **Motion detection:** The firmware sets the motion flag to 1 if any of
  the three sensors reports a distance less than 100 cm. This threshold
  corresponds to a typical hallway width of 200 cm, detecting a person
  at mid-distance. To prevent rapid toggling, we implemented debouncing:
  three consecutive positive readings are required to trigger the motion
  state (1.5 seconds at 2 Hz), and ten consecutive negative readings are
  required to clear it (5 seconds).

- **Brightness normalization:** The LDR module outputs an analog value
  from 0 to 1023 (10-bit ADC). We map this to a normalized range \[0,
  1\] for transmission to the Debian node, where the Weber-Fechner
  logarithmic mapping computes the target screen brightness.

- **Emergency button:** The firmware reads pin D2 every iteration. When
  the button is pressed (pin reads HIGH), it immediately sets the
  emergency flag to 1 in the outgoing packet. This gives the Debian node
  a maximum detection latency of 500 ms (one loop iteration).

- **Serial packet format:** Each transmission uses the format
  `SENSOR,motion,brightness,rain,emergency\n`, where `motion` is 0 or 1,
  `brightness` is the normalized LDR value (0–100), `rain` is the
  normalized potentiometer value (0–100), and `emergency` is 0 or 1.

<figure>
<img src="./assets/media/image12.jpeg"
style="width:5.83333in;height:2.71998in" />
<figcaption><p>Photograph of the sensor array mounted near the laptop
screen, showing the three HC-SR04 sensors positioned for left, center,
and right coverage.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/image13.png"
style="width:4.98326in;height:3.24074in" />
<figcaption><p>Screenshot of the Arduino IDE Serial Monitor at 9600
baud, showing five consecutive SENSOR: packets with motion, brightness,
rain, and emergency values.</p></figcaption>
</figure>

### Adaptive Brightness Algorithm

We implemented the Weber-Fechner logarithmic brightness mapping on the
Debian node using the formula:

``` math
B_{display} = B_{\min} + \left( B_{\max} - B_{\min} \right) \cdot L_{ambient}
```

where (B<sub>min</sub>= 10%) is the minimum readable brightness,
(B<sub>max</sub> = 100%) is the maximum brightness,
(L<sub>ambient</sub>) is the normalized LDR reading (0–1023 mapped to
0–1), and (L<sub>max</sub> = 1.0) is the maximum ambient light
calibration point.

When the Debian node receives a sensor packet, it extracts the
brightness value and applies the logarithmic mapping. The resulting
percentage is passed to the operating system’s display brightness API.
On Debian 13, we used the `brightnessctl` utility
(`brightnessctl set ${percentage}%`) to adjust the laptop screen
backlight. We verified the end-to-end control loop by covering the LDR
with a finger (brightness decreased within 1 second) and shining a
flashlight on it (brightness increased within 1 second).

### Simulated Edge Node Software

We implemented three Python services that run on each Debian 13 laptop,
simulating the software stack that would execute on a Raspberry Pi 4B in
production:

- **socket_client.py:** This service maintains a persistent Socket.IO
  connection to the central Node.js backend. It authenticates using a
  64-character hex device token stored in `~/.device_token`. It emits
  heartbeats every 10 seconds (`heartbeat` event with device status,
  uptime, and IP address), receives commands from the server
  (`signage_command`, `emergency_mode_start`, `emergency_mode_end`,
  `refresh_display`), and forwards sensor data from the Arduino to the
  server.

- **content_sync.py:** This service polls the backend every 60 seconds
  for new signage deployments. It downloads only changed assets
  (incremental sync) and caches them locally. For the Anthias-simulated
  node, it prepares assets in the format expected by the Anthias REST
  API. For the MPV-simulated node, it downloads files to
  `~/signage_media/` and maintains a local playlist.

- **scheduler.py (MPV only):** This service manages the content playback
  schedule. It reads the active deployment list from the cache, respects
  `start_date` and `end_date` windows, and advances to the next item at
  the configured display duration. When the server emits
  `refresh_display`, it immediately re-reads the deployment list.

### Systemd Service Configuration

We configured all three services to start automatically on Debian boot
using systemd unit files. Each unit specifies:

`After=network.target`: Service starts only after network is available

`Restart=on-failure`: Automatic restart if the service crashes

`RestartSec=10`: 10-second delay before restart

`StandardOutput=journal`: Logs captured in systemd journal

`User=signage`: Service runs under a dedicated non-root user

We verified the systemd configuration by running
`systemctl status socket-signage.service` and confirming the active
(running) state.

<figure>
<img src="./assets/media/image14.png"
style="width:4.96391in;height:3.24074in" />
<figcaption><p>Screenshot of the systemd status output showing
socket-signage.service as active (running), confirming automatic startup
on boot.</p></figcaption>
</figure>

## Network and Infrastructure Design

### Subnet Design

We designed the campus network around the subnet `10.20.0.0/22`, which
provides 1,022 usable IP addresses (4,094 total minus network,
broadcast, and gateway addresses). This represents 686% headroom above
the 130-node target, allowing for future expansion without renumbering.

<caption>Structured IP allocation within 10.20.0.0/22.</caption>
| Range | Purpose | Count |
|----|----|----|
| 10.20.0.1 – 10.20.0.19 | Infrastructure (gateway, DNS, NTP, management) | 19 |
| 10.20.0.20 – 10.20.0.49 | Server services (backend, database, nginx) | 30 |
| 10.20.0.50 – 10.20.3.199 | Edge nodes (displays, sensors) | 150 |
| 10.20.3.200 – 10.20.3.254 | Spare / future expansion | 55 |


### Layer 3 Isolation with Dual-NIC Server

Our server design uses two network interface cards (NICs) to enforce
Layer 3 isolation between the campus network and the signage network.
NIC-1 faces the campus (WAN) and accepts only SSH (port 22), HTTP (port
80), and HTTPS (port 443) traffic. NIC-2 faces the signage subnet (LAN)
and accepts API traffic (port 3000), RTMP ingest (port 1935), HLS
segment serving (port 443), DHCP (port 67/68), and DNS (port 53).

No direct routing exists between the campus subnet and the signage
subnet. All cross-subnet traffic must traverse the server, which applies
firewall rules, TLS termination, and rate limiting. This design prevents
a compromised campus workstation from directly attacking signage nodes.

<figure>
<img src="./assets/media/image15.png"
style="width:6.38228in;height:6.6809in"
alt="Fig 4.6 — Network topology diagram showing the dual-NIC Ubuntu server, core switches, edge switches, and Debian nodes in the 10.20.0.0/22 signage subnet." />
<figcaption><p>Network topology diagram showing the dual-NIC Ubuntu
server, core switches, edge switches, and Debian nodes in the
10.20.0.0/22 signage subnet.</p></figcaption>
</figure>

### Core Services

We deployed five core services on the Ubuntu server:

**dnsmasq:** Provides DHCP address assignment and local DNS resolution
for the signage subnet. This ensures nodes can resolve the server’s
address even if campus DNS fails.

**chrony:** Network Time Protocol (NTP) service ensures all nodes
maintain synchronized time, which is critical for content scheduling and
log correlation.

**nginx:** Reverse proxy and static file server. It terminates TLS 1.3
connections on the campus-facing NIC and proxies API requests to the
Node.js backend. It also caches HLS segments to reduce repeated backend
load.

**nftables:** Firewall enforcing the rule sets described in Section
4.6.3.

**tc (traffic control):** Rate-limits content sync traffic to prevent
edge switch saturation during bulk deployments.

### Bandwidth Engineering

<caption>Bandwidth analysis by operational scenario.</caption>
| Scenario | Concurrent Nodes | Per-Node Rate | Aggregate | Notes |
|----|----|----|----|----|
| Normal operation | 130 | 5 kbps (heartbeat) | 650 kbps | Negligible; WebSocket keepalive |
| Content push (images) | 130 | 500 KB every 60 s | ~10.8 Mbps | Bursty; `tc` limits to 5 Mbps sustained |
| Content push (videos) | 130 | 5 MB every 300 s | ~17.3 Mbps | Staggered by node ID to prevent thundering herd |
| Live stream (1080p HLS) | 130 | 4 Mbps | 520 Mbps | Served from nginx cache; backend not involved |
| Emergency broadcast | 130 | 200 KB (one-time) | 26 Mbps | Single multicast packet preferred |


### Failure Modes and Resilience

Our network design accommodates three failure modes:

**Server failure:** Nodes continue playing cached content for 72 hours
(the Service Level Agreement, or SLA). After 72 hours, they purge
content and display a disconnection image.

**Network partition:** If a node loses connectivity to the server, it
continues its cached schedule indefinitely within the 72-hour window.
When connectivity is restored, it re-authenticates and re-syncs.

**Power outage:** We sized uninterruptible power supply (UPS) units by
tier: 300 VA for the server (15 minutes runtime), 150 VA per core switch
(10 minutes), and 600 VA per building cluster (5 minutes for graceful
shutdown).

### Security Hardening at the Network Layer

We implemented nftables rules on both NICs. The campus-facing NIC
(NIC-1) accepts only SSH, HTTP, and HTTPS from the campus subnet, with
rate limiting on SSH to prevent brute-force attacks. The signage-facing
NIC (NIC-2) accepts only API, RTMP, HLS, DHCP, and DNS traffic from the
signage subnet, with explicit drops for all other ports and protocols.

<figure>
<img src="./assets/media/image16.png"
style="width:5.86328in;height:4.31482in"
alt="Fig 4.7 — Firewall rules diagram showing NIC-1 campus-facing rules (SSH/HTTP/HTTPS/NTP) and NIC-2 signage-facing rules (API/RTMP/HLS/DHCP/DNS)." />
<figcaption><p>Firewall rules diagram showing NIC-1 campus-facing rules
(SSH/HTTP/HTTPS/NTP) and NIC-2 signage-facing rules
(API/RTMP/HLS/DHCP/DNS).</p></figcaption>
</figure>

## Backend System Implementation

### Layered Architecture

Our backend follows a layered architecture: Express.js routes receive
HTTP requests, middleware validates authentication and input, services
encapsulate business logic, repositories abstract database access, and
Prisma ORM translates operations into PostgreSQL queries. This
separation ensures that business logic is independent of the transport
layer and database schema, making the system testable and maintainable.

<figure>
<img src="./assets/media/image17.png"
style="width:4.46031in;height:6.73025in"
alt="Fig 4.8 — Backend layered architecture diagram showing the data flow from Routes through Middleware, Services, Repositories, Prisma ORM, to PostgreSQL." />
<figcaption><p>Backend layered architecture diagram showing the data
flow from Routes through Middleware, Services, Repositories, Prisma ORM,
to PostgreSQL.</p></figcaption>
</figure>

### Database Design

Our PostgreSQL database, managed through Prisma ORM, contains the
following key entities:

**User:** `id`, `email`, `password_hash`, `role` (admin, creator,
viewer), `created_at`, `updated_at`

**Group:** `id`, `name`, `description`, `signage_state` (NORMAL,
BREAKING_NEWS, SECURITY_RISK, EMERGENCY), `created_by`

**Device:** `id`, `name`, `device_type` (anthias, mpv), `group_id`,
`device_token`, `last_seen`, `is_approved`

**Post:** `id`, `title`, `slug`, `description`, `signage_state`,
`start_date`, `end_date`, `is_enabled`, `created_by`

**SignageDeployment:** `id`, `post_id`, `device_id`, `priority`,
`is_active`

**LiveStream:** `id`, `name`, `url`, `type` (hls, rtsp, youtube, rtmp),
`is_active`

**Attachment:** `id`, `post_id`, `filename`, `type` (image, video,
document), `extracted_text`

Relationships include: User belongs to many Groups (many-to-many via
`UserGroup`), Group contains many Devices (one-to-many), Post belongs to
many Groups (many-to-many via `PostGroup`), and Device has many
SignageDeployments (one-to-many).

### Authentication and Authorization

We implemented a dual authentication system to secure both human users
and IoT edge nodes.

**User authentication (JWT):** When a user logs in, the backend
validates the email and password against bcrypt-hashed credentials
stored in PostgreSQL. Upon successful validation, it issues a JSON Web
Token (JWT) signed with a server-side secret and a configurable expiry
(default 24 hours). The frontend stores this token in `localStorage` and
sends it as a Bearer token in the `Authorization` header for every
subsequent API request. The `authenticateUser` middleware verifies the
token on every protected route.

**Device authentication (device token):** When a Debian node first
connects via Socket.IO, it sends its pre-assigned `device_id` in the
connection handshake. If the device is not yet approved, the server
generates a cryptographically random 64-character hexadecimal token and
sends it to the device via the `device_token` event. The device stores
this token in `~/.device_token`. On subsequent connections, the device
includes this token in its authentication payload. The server validates
the token against the database before accepting any commands or data
from the device. Unapproved devices cannot receive content or commands.

<figure>
<img src="./assets/media/image18.png"
style="width:5.83333in;height:5.337in"
alt="Fig 4.9 — Authentication flow sequence diagram showing JWT login for users and device token assignment for IoT nodes." />
<figcaption><p>Authentication flow sequence diagram showing JWT login
for users and device token assignment for IoT nodes.</p></figcaption>
</figure>

### User and Group Management

We implemented three roles with distinct capabilities, as summarized in
Table 4.4.

<caption>Role capabilities matrix.</caption>
| Capability | Administrator | Creator | Viewer | Public |
|----|----|----|----|----|
| Manage all devices | Yes | No | No | No |
| Manage assigned devices | Yes | Yes (own group) | No | No |
| Create/edit all posts | Yes | No | No | No |
| Create/edit own posts | Yes | Yes | No | No |
| Publish to any group | Yes | No | No | No |
| Publish to assigned groups | Yes | Yes | No | No |
| Trigger emergency mode | Yes | No | No | No |
| View public feed | Yes | Yes | Yes | Yes |
| Use AI Q&A | Yes | Yes | Yes | Yes (rate-limited) |
| Approve pending devices | Yes | No | No | No |
| Manage control locks | Yes | No | No | No |


**Group-scoped permissions:** Users belong to one or more Groups via the
`UserGroup` join table. Devices belong to exactly one Group. Posts can
be published to one or more Groups via the `PostGroup` join table. When
a Creator attempts to publish a post, the backend checks that the
Creator is a member of at least one of the target Groups. The
`cross_group_management` toggle on the User record allows Administrators
to bypass this check for specific trusted users.

<img src="./assets/media/image19.png"
style="width:2.9375in;height:3.60417in"
alt="Fig 4.10 — RBAC permission matrix diagram showing the mapping of roles (admin, creator, viewer, public) to system capabilities." /><img src="./assets/media/image19.png"
style="width:3.05556in;height:3.63889in"
alt="Fig 4.10 — RBAC permission matrix diagram showing the mapping of roles (admin, creator, viewer, public) to system capabilities." />

RBAC permission matrix diagram showing the mapping of roles (admin,
creator, viewer, public) to system capabilities.

### Content Lifecycle Management

A Post in our system has the following lifecycle states: `draft` →
`published` → `scheduled` → `expired`. Creators compose posts in draft
state using either the visual designer (Fabric.js) or the textual
designer (Markdown with KaTeX math rendering). When a Creator publishes
a post, the backend creates `SignageDeployment` records for each target
device. Each deployment record includes `start_date`, `end_date`,
`priority`, and `is_enabled` fields.

The Debian node polls `GET /api/signage/device/:id/deployments` every 60
seconds. The backend filters deployments to those where the current date
falls within `start_date` and `end_date`, the post status is
`published`, and `is_enabled` is `true`. Results are ordered by
priority, ensuring that emergency content always precedes normal
content.

When deployments change, the server emits `refresh_display` to affected
devices via Socket.IO. Devices immediately pull the updated playlist
rather than waiting for the next 60-second poll interval.

### Device Management and Control Locks

**Device lifecycle:** Administrators pre-register devices by assigning a
`device_id` in the admin dashboard. When a Debian node first connects,
it emits a heartbeat. The server assigns a device token and marks the
device as `pending_approval`. The Administrator approves the device,
which triggers token persistence and a `refresh_display` command.

**Control locks:** When multiple administrators or creators attempt to
control the same device simultaneously, the backend’s `control_lock`
mechanism prevents race conditions. A control lock record contains the
device ID, user ID, priority level, action type, and expiration
timestamp (30-second TTL by default).

The priority hierarchy is: Emergency system (priority 20) \>
Administrator (15) \> Creator (10) \> Viewer (5). A user can acquire a
lock only if no higher-priority lock is active on the same device. If an
equal or lower-priority lock exists, the request is rejected with HTTP
423 (Locked), and the response indicates who holds the lock and when it
expires.

<figure>
<img src="./assets/media/image20.png"
style="width:5.93891in;height:3.00766in"
alt="Fig 4.25 — Control lock acquisition flow sequence diagram showing Administrator A acquiring a lock on Device 3, and Creator B receiving a 423 Locked response." />
<figcaption><p>Control lock acquisition flow sequence diagram showing
Administrator A acquiring a lock on Device 3, and Creator B receiving a
423 Locked response.</p></figcaption>
</figure>

**Multi-creator priority synchronization:** When two creators publish
posts to the same device group, the `priority` field on each
`SignageDeployment` record determines playback ordering. Additionally,
the signage state hierarchy `EMERGENCY` \> `SECURITY_RISK` \>
`BREAKING_NEWS` \> `NORMAL` ensures that higher-priority states always
take precedence, regardless of the individual post priorities.

**Online/offline tracking:** The server maintains a `last_seen`
timestamp for each device, updated on every heartbeat. If a device
misses three consecutive heartbeats (30 seconds), the server marks it as
offline. The admin dashboard displays real-time device status.

### Signage Deployment Engine

The deployment engine is the core scheduling subsystem. When a Creator
publishes a post to a group, the backend creates `SignageDeployment`
records for all devices in that group. Each record captures:

`post_id` - reference to the content

`device_id` - target device

`priority` - numeric priority within the group

`start_date` and `end_date` - temporal validity window

`is_enabled` - boolean toggle for temporary suppression

The Debian node polls for deployments every 60 seconds with jitter (±5
seconds) to prevent thundering herd. The response is a JSON array
ordered by priority. For Anthias-simulated nodes, the agent uploads
assets via the Anthias REST API. For MPV-simulated nodes, the agent
downloads files to `~/signage_media/` and updates the local playlist.

### Media Processing Pipeline

All uploaded media passes through a backend processing pipeline before
being served to devices.

**Images (Sharp):** Uploaded PNG or JPEG files are auto-oriented based
on EXIF data, optionally cropped using percentage-based coordinates from
the frontend (`react-easy-crop`), resized if they exceed 4096 × 4096
pixels, compressed to WebP format at quality 88, and saved to
`uploads/images/{uuid}.webp`. WebP provides approximately 30% smaller
file sizes than JPEG at equivalent quality.

**Videos (FFmpeg):** Uploaded MOV, AVI, or MP4 files are probed for
metadata (duration, resolution, codec, bitrate), optionally trimmed
using temporal start/end times from the frontend (`VideoTrimSlider`),
optionally cropped using spatial coordinates, transcoded to H.264 video
with AAC audio in an MP4 container with faststart (moov atom at file
beginning for progressive download), and saved to
`uploads/videos/{uuid}.mp4`.

**Documents (PDF/DOCX/PPTX):** Text is extracted using `mammoth` (for
DOCX/PPTX) and `pdf-parse-fork` (for PDF). The extracted text is stored
in the Attachment record and provided as context to the AI Q&A system.

<figure>
<img src="./assets/media/image21.png"
style="width:5.83333in;height:1.75566in"
alt="Fig 4.26 — Media processing pipeline flowchart showing image processing (Sharp), video processing (FFmpeg), and document text extraction (mammoth/pdf-parse-fork) paths." />
<figcaption><p>Media processing pipeline flowchart showing image
processing (Sharp), video processing (FFmpeg), and document text
extraction (mammoth/pdf-parse-fork) paths.</p></figcaption>
</figure>

Static files are served from `/uploads/*` and `/streams/*` via Express
static middleware with path traversal protection. All paths are resolved
with `path.resolve()` and checked against the upload root directory.

### Live Stream Relay

Our system supports four stream types, summarized in Table 4.5.

<caption>Stream types and relay architecture.</caption>
| Type | Ingest Source | Relay Mechanism | Player Support |
|----|----|----|----|
| HLS | External `.m3u8` URL | Direct proxy + nginx segment caching | Anthias (Chromium), MPV |
| RTSP | IP camera URL | FFmpeg → HLS segments | MPV (native), Anthias (hls.js) |
| YouTube | YouTube HLS URL | Proxy + yt-dlp resolution | Anthias (Chromium) |
| RTMP | OBS/Encoder push to port 1935 | `node-media-server` → FFmpeg → HLS | Anthias (hls.js), MPV |


The RTMP ingest server listens on port 1935. When a stream is
configured, the backend spawns an FFmpeg child process that transcodes
the input to HLS segments stored in `streams/{id}/`. A background health
monitor checks each relay process every 30 seconds; if a process has
crashed, the monitor kills any zombie processes, restarts the relay, and
logs the incident. Auto-restart is capped at five attempts within ten
minutes to prevent infinite loops.

<figure>
<img src="./assets/media/image22.png"
style="width:5.83333in;height:0.45205in"
alt="Fig 4.11 — Stream relay pipeline diagram showing OBS → RTMP → FFmpeg → HLS segments → nginx → Anthias/MPV playback." />
<figcaption><p>Stream relay pipeline diagram showing OBS → RTMP → FFmpeg
→ HLS segments → nginx → Anthias/MPV playback.</p></figcaption>
</figure>

###  Emergency Broadcast System

Our emergency broadcast system supports three independent trigger
sources:

**Hardware trigger:** The Arduino emergency button sends an
`emergency:1` flag in the sensor packet. The Debian node detects this
flag and immediately plays the local `emergency_fallback.mp4` file, even
if the server is unreachable. It then attempts to notify the server via
the `emergency_trigger` Socket.IO event.

**Server command:** An Administrator sets a group’s `signage_state` to
`EMERGENCY` in the admin dashboard. The backend updates the database and
broadcasts `emergency_mode_start` to all online devices in that group.

**Group state change:** Any authorized API client can set a group’s
state, enabling integration with external safety systems such as fire
alarm APIs.

The signage state hierarchy is strict: `EMERGENCY` \> `SECURITY_RISK` \>
`BREAKING_NEWS` \> `NORMAL`. This hierarchy is enforced in both backend
deployment queries and frontend state selection UI. Emergency mode does
not clear automatically; it requires all assigned groups to return to
`NORMAL` state before devices resume scheduled content.

<figure>
<img src="./assets/media/image23.png"
style="width:5.83333in;height:2.95173in"
alt="Fig 4.27 — Emergency broadcast state machine diagram showing transitions between Normal, Emergency, Disconnected, SecurityRisk, and BreakingNews states." />
<figcaption><p>Emergency broadcast state machine diagram showing
transitions between Normal, Emergency, Disconnected, SecurityRisk, and
BreakingNews states.</p></figcaption>
</figure>

###  Socket.IO Real-Time Bus

Our Socket.IO implementation supports the following events:

**Inbound events (Debian node → Server):** - `heartbeat` - device
status, uptime, IP address, sensor readings (every 10 s) -
`device_online` / `device_offline` - connection state transitions -
`signage_asset_synced` - confirmation that Anthias received uploaded
assets - `error_log` - remote error collection for debugging -
`emergency_trigger` - hardware button pressed

**Outbound events (Server → Debian node):** - `device_token` - assign or
re-assign authentication token - `signage_command` - publish, hide,
show, delete, next, previous, start - `emergency_mode_start` /
`emergency_mode_end` - group-wide emergency state - `refresh_display` /
`restart_display` - content or player reload

**Ack support:** We implemented `emitToDeviceAck`, which uses Socket.IO
timeouts to confirm that the Debian node received a command. This is
essential for signage control, where “fire and forget” command delivery
is unacceptable.

###  Fault Tolerance and Race Condition Handling

We designed the backend to handle several concurrent access scenarios:

Two administrators sending `next` to the same device → the control lock
prevents the second command from executing until the first lock expires.

Creator A publishing a high-priority post while Creator B publishes a
low-priority post → priority ordering resolves the conflict; the
higher-priority post plays first.

An administrator triggering emergency mode while a creator publishes
normal content → the state hierarchy ensures emergency content takes
precedence.

Server restart during active streams → the health monitor detects
missing relay processes and auto-restarts them within 30 seconds.

Network partition → Debian nodes continue playing cached content for 72
hours, then display the disconnection fallback image.

Critical database operations use ACID transactions through PostgreSQL
and Prisma, including emergency state changes, device token generation,
and deployment creation.

###  AI-Assisted Public Engagement

Public visitors browse `/feed` and `/post/:id` without authentication.
The AI Q&A widget at the bottom of each post detail page sends the
user’s question, conversation history, and extracted document text from
attachments to `POST /api/ai/ask`. The backend forwards this context to
the OpenAI GPT API and streams the response back to the frontend in real
time. Rate limiting (10 questions per IP per hour) prevents abuse.

## Frontend and User Interface

We built the frontend in React 19 with Vite for fast development builds
and hot module replacement. State management uses Zustand for its
minimal API and lack of boilerplate. HTTP requests use Axios with
request/response interceptors for JWT token attachment and 401
unauthorized handling. Real-time updates use Socket.IO Client with lazy
connection (only connects on pages that need live data).

### Admin Dashboard

The admin dashboard provides a unified interface for system management.

**Authentication:** The login page accepts email and password, validates
credentials against the backend, and stores the JWT and user profile in
`localStorage`. On application boot, the frontend validates token expiry
and redirects to the login page if expired.

<figure>
<img src="./assets/media/image24.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.12 — Login page with empty username and password fields, campus branding visible; Sign In button disabled until both fields are filled." />
<figcaption><p>Login page with empty username and password fields,
campus branding visible; Sign In button disabled until both fields are
filled.</p></figcaption>
</figure>

**Group Management:** Administrators view all groups in a table with
inline editing for name, description, and signage state. New groups are
created via a modal form.

<figure>
<img src="./assets/media/image25.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.13 — Admin Groups page listing all campus groups with display state, member count, and assigned devices." />
<figcaption><p>Admin Groups page listing all campus groups with display
state, member count, and assigned devices.</p></figcaption>
</figure>

**User Management:** Administrators view all users with their roles and
group assignments. Inline editing supports role changes and group
membership updates.

<figure>
<img src="./assets/media/image26.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.14 — Admin Users page showing all registered accounts with roles, groups, and permissions." />
<figcaption><p>Admin Users page showing all registered accounts with
roles, groups, and permissions</p></figcaption>
</figure>

**Device Management:** The devices page lists all registered and pending
devices. Administrators approve pending devices (assigning device
tokens), view device status (online/offline, last seen), and send
playback commands (next, previous, start).

<figure>
<img src="./assets/media/image27.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.15 — Admin Devices page showing the registered hardware fleet with online/offline status, register form, and settings inspector." />
<figcaption><p>Admin Devices page showing the registered hardware fleet
with online/offline status, register form, and settings
inspector.</p></figcaption>
</figure>

### Creator Dashboard

The creator dashboard is the primary content authoring interface.

**Posts:** Creators compose posts with a title, Markdown description,
URL slug, and attachments. The form supports image upload with cropping,
video upload with trimming, and document upload for AI context.

<figure>
<img src="./assets/media/image28.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.16 — Creator Posts page with the new-post editor on the left and the post list with filters on the right." />
<figcaption><p>Creator Posts page with the new-post editor on the left
and the post list with filters on the right.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/image29.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.17a — Image cropping interface with aspect ratio locking to 16:9 for signage compatibility, drag and zoom controls visible." />
<figcaption><p>Image cropping interface with aspect ratio locking to
16:9 for signage compatibility, drag and zoom controls
visible.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/image30.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.17b — Video trimming slider used to extract specific clips before attaching to a post, start and end handles visible." />
<figcaption><p>Video trimming slider used to extract specific clips
before attaching to a post, start and end handles
visible.</p></figcaption>
</figure>

**Visual Designer (Fabric.js):** Creators can design signage slides with
draggable text, shapes, and images on a canvas. The designer supports
layering, opacity, and export to PNG.

<figure>
<img src="./assets/media/image31.png"
style="width:5.69269in;height:3.28125in" />
<figcaption><p>Creator Visual Designer with an empty Fabric.js canvas
and toolbar on the top for adding text, shapes, and
images.</p></figcaption>
</figure>

**Textual Designer (Markdown + KaTeX):** Creators can compose text-heavy
slides using Markdown syntax with live KaTeX math rendering. The
exported result is a styled HTML slide.

<figure>
<img src="./assets/media/image32.png"
style="width:5.83333in;height:3.10245in" />
<figcaption><p>Designer in Markdown mode with empty editor on the top
and live-preview panel on the buttom, supporting KaTeX math
notation.</p></figcaption>
</figure>

**Signage Publishing:** Creators select target groups and set scheduling
parameters (start date, end date, priority) before publishing.

<figure>
<img src="./assets/media/image33.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.20 — Signage Publish page listing publishable posts on the left and target devices on the right, with duration and priority controls." />
<figcaption><p>Signage Publish page listing publishable posts on the
left and target devices on the right, with duration and priority
controls.</p></figcaption>
</figure>

**Live Stream Management:** Creators can add, edit, and monitor live
streams. The interface displays stream health status and provides embed
codes.

<figure>
<img src="./assets/media/image34.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.21 — Live Streams page with the list of existing streams showing source type and status, plus the creation form." />
<figcaption><p>Live Streams page with the list of existing streams
showing source type and status, plus the creation form.</p></figcaption>
</figure>

### Public Feed and Viewer Interface

Public visitors access `/feed` to browse all published posts in a
responsive grid layout. Clicking a post navigates to `/post/:id` for the
full content view.

<figure>
<img src="./assets/media/image35.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.22 — Public feed showing all campus announcements sorted by priority and recency, no login required." />
<figcaption><p>Public feed showing all campus announcements sorted by
priority and recency, no login required.</p></figcaption>
</figure>

### AI Q&A Widget

The AI Q&A widget appears at the bottom of each post detail page.
Visitors type questions, and the system sends the question, conversation
history, and extracted document text to the OpenAI GPT API. Responses
stream in real time.

<figure>
<img src="./assets/media/image36.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.23 — AI chat window opened on a post detail page, ready for user questions grounded on post text and attachments." />
<figcaption><p>AI chat window opened on a post detail page, ready for
user questions grounded on post text and attachments.</p></figcaption>
</figure>

### Emergency Handling UI

Administrators trigger emergency mode from the Groups page by setting a
group’s signage state to `EMERGENCY`. A confirmation dialog prevents
accidental activation.

<figure>
<img src="./assets/media/image37.png"
style="width:5.83333in;height:3.28125in"
alt="Fig 4.24 — Groups page showing the Emergency Broadcast group in EMERGENCY state with red indicator and inline state controls." />
<figcaption><p>Groups page showing the Emergency Broadcast group in
EMERGENCY state with red indicator and inline state
controls.</p></figcaption>
</figure>

### State Management

We chose Zustand over Redux for state management because its API
requires no boilerplate (no action types, reducers, or dispatch
functions). Our store modules include:

`authStore`: JWT token, user profile, login/logout actions

`uiStore`: Theme, sidebar state, notification queue

`dataStore`: Cached API responses with automatic invalidation

Axios interceptors attach the Bearer token to every outgoing request and
handle 401 responses by redirecting to the login page. Socket.IO Client
connects lazily (only on pages requiring real-time data) and reconnects
automatically with exponential backoff.

## Dual Player Architecture

Our system supports two playback backends on a per-device basis,
enabling administrators to choose the most appropriate player for each
display’s content requirements.

<caption>Anthias versus MPV comparison.</caption>
| Feature          | Anthias                         | MPV                      |
|------------------|---------------------------------|--------------------------|
| Rendering engine | Dockerized Chromium             | Native OpenGL/VAAPI      |
| Content types    | HTML, images, videos, web pages | Images, videos, streams  |
| Boot time        | 15–30 s (Docker + browser)      | 1–2 s                    |
| Memory footprint | 400–600 MB                      | 50–150 MB                |
| Web content      | Full CSS/JS support             | Not supported            |
| Hardware decode  | Limited                         | Full V4L2/VDPAU          |
| Remote commands  | Anthias REST API                | Direct MPV IPC socket    |
| Overlay support  | CSS-based                       | Lua scripting            |
| Use case         | Rich interactive signage        | Fast-boot video playback |


**Shared communication layer:** Both player types use the same
`socket_client.py` for Socket.IO communication, the same
`content_sync.py` for asset synchronization, and the same authentication
mechanism. The backend determines which player a device uses based on
the `device_type` field (set during device registration), and the
appropriate control commands are sent accordingly.

## Security Implementation

### Threat Model

We identified four trust boundaries in our system architecture: the
Campus LAN (untrusted), the Server DMZ (semi-trusted), the Database Zone
(trusted), and the Signage LAN (trusted but vulnerable to physical
access). Figure 4.28 illustrates these boundaries and the attack
surfaces at each layer.

<figure>
<img src="./assets/media/image38.png"
style="width:5.83333in;height:1.28618in"
alt="Fig 4.28 — Attack surface diagram showing trust boundaries: Campus LAN → Server DMZ → Database Zone → Signage LAN, with identified attack vectors at each layer." />
<figcaption><p>Attack surface diagram showing trust boundaries: Campus
LAN → Server DMZ → Database Zone → Signage LAN, with identified attack
vectors at each layer.</p></figcaption>
</figure>

### Vulnerabilities Addressed

We conducted a security audit of the codebase and identified 12
vulnerabilities, summarized in Table 4.7.

<caption>Vulnerability inventory and remediation status.</caption>
| ID | Severity | Component | Description | Remediation |
|----|----|----|----|----|
| V-01 | P0 (Critical) | Socket.IO | Unauthenticated device connections accepted any Pi on the network | Device token authentication; 64-char hex tokens |
| V-02 | P0 (Critical) | API | No rate limiting on login endpoint enabled brute-force attacks | Express-rate-limit: 5 attempts per 15 min per IP |
| V-03 | P0 (Critical) | File upload | Path traversal possible via malicious filename | `path.resolve()` + root directory check |
| V-04 | P0 (Critical) | CORS | Wildcard CORS allowed any origin to access API | Whitelist of allowed origins |
| V-05 | P1 (High) | JWT | Tokens had no expiry; stolen tokens valid forever | 24-hour expiry + refresh token rotation |
| V-06 | P1 (High) | Database | Prisma queries lacked parameterized input in one route | All queries use Prisma query builder |
| V-07 | P1 (High) | Socket.IO | No origin validation on WebSocket handshake | `io.engine.use(cors(...))` with whitelist |
| V-08 | P1 (High) | Static files | Directory listing enabled on `/uploads/` | `dotfiles: 'deny'` in Express static config |
| V-09 | P1 (High) | Logging | Error logs contained stack traces with file paths | Sanitized logs; no paths in production |
| V-10 | P2 (Medium) | Frontend | `localStorage` stored JWT without encryption | Acceptable risk; HTTPS mitigates transmission |
| V-11 | P2 (Medium) | API | No Content Security Policy headers | Added `helmet` middleware with CSP |
| V-12 | P2 (Medium) | Network | nftables rules not persisted across reboots | `nftables-persistent` package + systemd service |


<figure>
<img src="./assets/media/image39.png"
style="width:7.30918in;height:8.33763in"
alt="Fig 4.29 — Screenshot of the Socket.IO authentication code showing device token verification in the connection handshake handler." />
<figcaption><p>Screenshot of the Socket.IO authentication code showing
device token verification in the connection handshake
handler.</p></figcaption>
</figure>

### Network Hardening

We implemented nftables rules on both server NICs. The campus-facing NIC
accepts only SSH (rate-limited), HTTP, and HTTPS. The signage-facing NIC
accepts only API, RTMP, HLS, DHCP, and DNS traffic. All other ports and
protocols are explicitly dropped. TLS 1.3 termination on nginx ensures
encrypted communication between the frontend and backend.

### Remediation Summary

All four P0 (critical) and five P1 (high) vulnerabilities were
remediated before system validation. The three P2 (medium)
vulnerabilities were documented as accepted risks with mitigating
controls. No P0 or P1 vulnerabilities remain in the production codebase.

------------------------------------------------------------------------

This chapter has presented the complete design and implementation of the
Smart Digital Signage System, from the physical Arduino sensor bridge
through the Debian-simulated edge nodes, network infrastructure, backend
services, frontend interfaces, dual player architecture, and security
hardening. The following chapter describes how we validated this
implementation through automated testing and hardware verification.

\newpage