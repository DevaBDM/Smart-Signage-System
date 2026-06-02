# Chapter 6 {.title}

# Discussion

This chapter closes the problem-solution loop established in Chapter 1.
We examine how each identified problem is solved by our implementation,
assess what is production-ready versus what requires further validation,
acknowledge the limitations of our prototype, and position our
contributions relative to existing platforms.

## How the Problems Are Solved

### Problem P1 - Energy Waste from Fixed-Brightness Operation

Our system solves the energy waste problem through three integrated
mechanisms. First, the LDR module on the Arduino sensor bridge measures
ambient light every 500 ms and transmits the reading to the Debian edge
node. Second, the Weber-Fechner logarithmic mapping (Section 4.1.4)
converts the raw sensor value into a perceptually appropriate screen
brightness percentage. Third, the Debian node applies this percentage to
the display backlight via the operating system’s brightness API
(`brightnessctl`).

We validated this control loop end-to-end: covering the LDR caused the
screen to dim within 1 second, and shining a flashlight on the LDR
caused it to brighten within 1 second. While we could not measure actual
wattage savings with a power meter, our calculated analysis (Section
5.5.2) projects a 25–40% reduction in display energy consumption for a
campus-wide deployment.

The key insight is that brightness adaptation is not merely a software
feature but a closed-loop control system with real physical sensing,
real-time computation, and real actuator output. This integration
distinguishes our approach from software-only brightness scheduling that
lacks environmental feedback.

### Problem P2 - Disconnected, Unmanaged Display Nodes

Our system replaces isolated display nodes with a unified management
architecture. The central Node.js backend maintains a registry of all
devices, their online/offline status, their group assignments, and their
current content deployments. Administrators manage the entire fleet from
a single dashboard, rather than logging into each node individually.

The role-based access control system (Section 4.3.4) enables
multi-department campuses to delegate content creation to individual
groups without granting universal admin privileges. A department head
can be assigned as a Creator for their building’s group, publishing
content that appears only on their assigned displays, while an IT
administrator retains full system control.

Real-time command propagation via Socket.IO (Section 4.3.11) ensures
that administrative actions take effect within seconds rather than
requiring physical visits or scheduled batch updates.

### Problem P3 - Security Gap in Unauthenticated IoT Communication

Our dual authentication system (Section 4.3.3) closes the
unauthenticated IoT vulnerability that affects most open-source digital
signage platforms. Device tokens are cryptographically random
64-character hex strings generated server-side, stored in a sidecar file
on each node, and validated on every Socket.IO connection. An unapproved
device cannot receive content or commands, and a device with an invalid
or expired token is immediately disconnected.

The control lock mechanism (Section 4.3.6) adds a second layer of
security by preventing race conditions when multiple administrators
attempt to control the same device simultaneously. The priority
hierarchy ensures that emergency commands always take precedence over
routine operations.

Our security audit (Section 4.6.2) identified and remediated four
critical (P0) and five high (P1) vulnerabilities before system
validation, including brute-force protection, path traversal prevention,
CORS whitelist enforcement, and JWT token expiry.

### Problem P4 - High Total Cost of Ownership

Our open-source stack eliminates licensing fees entirely. The five-year
TCO for a 130-display campus is projected at \$118,000 (hardware,
energy, maintenance), compared to \$187,000–\$390,000 for commercial
alternatives (Table 5.3 and Fig. 5.7). The savings come from three
sources: zero software licensing (100% of commercial licensing costs
eliminated), reduced energy consumption through adaptive brightness
(25–40% display power reduction), and unified management reducing
per-device administration time.

It is important to note that our TCO calculation assumes hardware costs
for Raspberry Pi 4B devices rather than the laptops we used in our
prototype. The Debian 13 live USB sessions on laptops validated the
software stack; production deployment would use actual Pi 4B devices at
\$55 per unit.

## Implementation Readiness

### Production-Ready Components

The following subsystems are production-ready and require only hardware
procurement for campus deployment:

**Backend services:** The Node.js backend with Express.js, Prisma ORM,
PostgreSQL, Socket.IO, and media processing (Sharp, FFmpeg) is fully
implemented and tested. It can handle the 130-node target with the
hardware specifications described in Chapter 4.

**Frontend application:** The React frontend with role-based dashboards,
content designers, and public feed is complete and documented through 55
Playwright screenshots.

**Authentication and RBAC:** The dual authentication system (JWT for
users, device tokens for nodes) and three-role RBAC with group scoping
are implemented and validated.

**Media processing pipeline:** Image optimization (Sharp), video
transcoding (FFmpeg), and document text extraction
(mammoth/pdf-parse-fork) are operational.

**Socket.IO real-time bus:** The event system with acknowledgment
support and device lifecycle management is tested and reliable.

### Components Requiring Field Validation

The following components would benefit from extended field testing
before full campus deployment:

**Adaptive brightness calibration:** Our Weber-Fechner mapping used a
fixed calibration point. Real campus environments have highly variable
lighting (fluorescent, LED, natural daylight, night) that may require
per-location calibration.

**Motion detection accuracy:** The 100 cm threshold and 3-reading
debounce were validated in our lab environment. Real hallways with
varying widths, ceiling heights, and pedestrian traffic patterns may
require threshold tuning.

**Network bandwidth at scale:** Our bandwidth analysis (Table 4.3) is
theoretical. Actual campus networks with competing traffic (Wi-Fi, VoIP,
security cameras) may require Quality of Service (QoS) prioritization
for signage traffic.

**UPS sizing:** Our UPS estimates (Section 4.2.5) are based on datasheet
specifications. Actual runtime depends on battery age, temperature, and
load factor.

## Limitations and Assumptions

Our prototype has the following limitations that should be considered
when interpreting our results:

**Simulated edge nodes:** We used laptops running Debian 13 live USB
sessions to simulate Raspberry Pi 4B edge nodes. While Debian 13
provides the same software environment as Raspberry Pi OS, the laptops
have different hardware specifications (x86_64 vs. ARM, different GPU
architectures, different power profiles). Production deployment would
require validation on actual Pi 4B hardware.

**Calculated power figures:** We did not have access to a digital
multimeter or watt meter during our prototype phase. All power
consumption figures in Chapter 5 were calculated from manufacturer
datasheets. Actual power draw may differ due to component variation,
environmental temperature, and measurement methodology.

**Single server point of failure:** Our prototype used a single
development server (a laptop running Node.js, PostgreSQL, and nginx).
The campus-scale design in Chapter 4 describes a single dual-NIC server,
which represents a single point of failure. Production deployment should
include server redundancy (hot standby or container orchestration with
Kubernetes).

**Limited mobile testing:** The frontend is designed desktop-first.
While the public feed is responsive, the admin and creator dashboards
are optimized for large screens. Mobile-responsive administration and
touch-screen kiosk mode are not implemented.

**Two-node prototype scale:** Our prototype validated the architecture
with two simulated nodes. While the design targets 130 nodes, we did not
perform load testing with more than two concurrent devices. The
architecture (poll-based content sync, Socket.IO room broadcasting) is
designed to scale, but this was not empirically validated.

**No long-term energy measurement:** Our energy savings projection
(25–40% reduction) is based on the Weber-Fechner curve and duty cycle
models. Field validation with watt meters over a semester of operation
would provide empirical confirmation.

## Comparison with Related Work

Table 6.1 maps each of the seven research gaps identified in Chapter 2
to the specific feature in our system that addresses it, and compares
the outcome with the closest related work.

<caption>Research gap mapping and comparison with related work.</caption>
| \# | Research Gap | Our Solution | Closest Related Work | Our Advantage |
|----|----|----|----|----|
| 1 | No open-source platform combines sensing, CMS, and RBAC | Unified system with Arduino sensors + Node.js backend + React frontend + RBAC | Anthias \[1\]: CMS only, no sensing or RBAC | Three subsystems integrated; not siloed |
| 2 | No platform integrates ambient light sensing with CMS | LDR → Arduino → Debian brightness API → screen, controlled by backend deployments | Park et al. \[23\]: Standalone prototype, no CMS | Sensing is part of content scheduling; brightness adapts to scheduled content |
| 3 | No device token authentication for Pi-class nodes | 64-char hex tokens, server-generated, sidecar file storage | PiSignage \[2\]: Default credentials `pi:pi` | Cryptographic tokens vs. default passwords |
| 4 | No campus-scale network security design | Dual-NIC Layer 3 isolation, nftables, TLS 1.3, documented hardening | Stango et al. \[28\]: VLAN segmentation general | Applied specifically to digital signage with documented rules |
| 5 | No open-source streaming at zero cost | RTMP→HLS relay, 4 stream types, FFmpeg health monitor | Anthias \[1\]: No streaming | Integrated streaming without per-screen fees |
| 6 | No emergency broadcast with hardware trigger | Physical button → local playback + group-wide Socket.IO broadcast | Rise Vision \[9\]: Template-based alerts only | Hardware trigger works offline; group override is automatic |
| 7 | No concurrency control for multi-user access | Control locks with priority hierarchy, 423 Locked responses | All surveyed platforms: single admin or no locking | Prevents race conditions in multi-admin environments |


Our system is the first open-source digital signage platform to combine
all seven capabilities in a single integrated implementation. While
individual research prototypes have addressed subsets of these gaps
(ambient light sensing, RBAC, streaming), no prior work unifies them
into a deployable system with documented network security and hardware
authentication.

This chapter has discussed how our system solves the problems identified
in Chapter 1, assessed what is ready for production deployment,
acknowledged the limitations of our prototype, and positioned our work
against the existing literature. The following chapter concludes the
report and outlines directions for future work.

\newpage