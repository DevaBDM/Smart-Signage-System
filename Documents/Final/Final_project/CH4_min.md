#  Chapter 4 {.title}

# System Design and Implementation

This chapter details the technical implementation of the Smart Digital 
Signage System, traversing the hardware sensing layer, the secure 
network infrastructure, and the full-stack management platform. 

## Hardware Implementation

### Component Selection and Specifications

The hardware layer is engineered for reliability and precision, using an embedded microcontroller architecture for real-time environmental sampling.

<caption>Table 4.1: Component specifications and pin assignments.</caption>
| Component | Specification | Purpose |
|----|----|----|
| Embedded Controller | ATmega2560 Architecture | Sensor acquisition and preprocessing |
| Ultrasonic Sensors | 2–400 cm range | Motion and proximity detection |
| LDR Module | 10-bit ADC output | Ambient light sensing |
| Manual Override | Push button interrupt | Hardware emergency trigger |
| Edge Node | x86_64 / ARM Architecture | Software-defined display agent |

### Physical Assembly and Wiring

The sensor bridge assembly ensures comprehensive environmental coverage, oriented to eliminate detection dead-zones.

<figure>
<img src="./assets/media/fig4_1_prototype_assembly.jpg" style="width:5.83333in;height:2.72157in" />
<figcaption><p>Figure 4.1: Integrated sensor bridge prototype providing real-time environmental awareness.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/fig4_2a_sensor_wiring.png" style="width:5in;height:3.5in" />
<figcaption><p>Figure 4.2: Sensor wiring diagram and schematic representation.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/fig4_2b_sensor_wiring.png" style="width:5in;height:4.5in" />
<figcaption><p>Figure 4.3: Circuit simulation of the sensor bridge connections.</p></figcaption>
</figure>

### Sensor Fusion and Preprocessing

The embedded firmware implements a deterministic, non-blocking execution 
loop. Motion detection utilizes advanced temporal filtering to distinguish between meaningful viewer presence and environmental noise.

<figure>
<img src="./assets/media/fig4_4_serial_monitor.png" style="width:4.98326in;height:3.24074in" />
<figcaption><p>Figure 4.4: Serial monitor output showing packetized environmental data.</p></figcaption>
</figure>

### Perceptual Adaptive Brightness Algorithm

We implemented a logarithmic mapping algorithm based on the Weber-Fechner Law. This ensures that display brightness adjustments feel natural while maximizing energy efficiency.

### Simulated Edge Node Software

The edge nodes operate a suite of container-ready services including a real-time command bus, asynchronous sync service, and intelligent content scheduler.

### Systemd Service Configuration

Services are managed by a process controller to ensure high availability and automatic recovery.

<figure>
<img src="./assets/media/fig4_5_systemd_status.png" style="width:4.96391in;height:3.24074in" />
<figcaption><p>Figure 4.5: Systemd service status showing active running state.</p></figcaption>
</figure>

## Network and Infrastructure Design

### Subnet Design

The network is designed around a dedicated institutional subnet providing significant headroom for future expansion.

<caption>Table 4.2: Structured IP allocation for signage infrastructure.</caption>
| Range | Purpose |
|----|----|
| 10.20.0.1 – .19 | Infrastructure (Gateway, DNS, NTP) |
| 10.20.0.20 – .49 | Core Services (Backend, DB) |
| 10.20.0.50 – .3.199 | Edge Nodes (Displays) |

### Layer 3 Isolation with Dual-NIC Server

The system enforces strict Layer-3 isolation, physically separating the public 
campus network from the private signage subnet.

<figure>
<img src="./assets/media/fig3_2_network_topology.png" style="width:6.38228in;height:6.6809in" />
<figcaption><p>Figure 4.6: Network topology diagram with dual-NIC isolation.</p></figcaption>
</figure>

### Core Services

We deployed core infrastructure services including local DNS, NTP synchronization, and a high-performance reverse proxy for secure traffic orchestration.

### Bandwidth Engineering

<caption>Table 4.3: Bandwidth analysis by operational scenario.</caption>
| Scenario | Concurrent Nodes | Aggregate Bandwidth |
|----|----|----|
| Normal Operation | 130 | < 1 Mbps |
| Content Deployment | 130 | ~15 Mbps (Burst) |
| Live Streaming | 130 | ~520 Mbps (Cached) |

### Failure Modes and Resilience

The architecture ensures offline-first resilience with local caching and autonomous failover mechanisms.

### Security Hardening at the Network Layer

Firewall rules enforce a "Default-Deny" posture across all interfaces.

<figure>
<img src="./assets/media/fig6_4_firewall_rules.png" style="width:5.86328in;height:4.31482in" />
<figcaption><p>Figure 4.7: Firewall rules for institutional network interfaces.</p></figcaption>
</figure>

## Backend System Implementation

### Layered Architecture

The backend is built as a high-performance, stateless API service layer following a clean architectural pattern.

<figure>
<img src="./assets/media/fig3_3_backend_layers.png" style="width:4.46031in;height:6.73025in" />
<figcaption><p>Figure 4.8: Backend layered architecture data flow.</p></figcaption>
</figure>

### Database Design

A normalized relational database ensures ACID compliance for all organizational and content data.

<caption>Table 4.4: Relational integrity and normalization status.</caption>
| Normal Form | Status | Implementation Evidence |
|----|----|----|
| 1NF, 2NF, 3NF | Achieved | Normalized schema with junction tables and no transitive dependencies. |

### Authentication and Authorization

We implemented a dual authentication system to secure both human users 
and IoT edge nodes.

<figure>
<img src="./assets/media/fig6_3_auth_flow.png" style="width:5.83333in;height:5.337in" />
<figcaption><p>Figure 4.9: JWT user and device token authentication flow.</p></figcaption>
</figure>

### User and Group Management

Granular, group-scoped permissions are enforced via RBAC.

<caption>Table 4.5: Role capabilities and access control matrix.</caption>
| Role | Admin | Creator | Viewer |
|----|----|----|----|
| Full System Control | Yes | No | No |
| Assigned Group Management | Yes | Yes | No |

<figure>
<img src="./assets/media/fig6_5_rbac_matrix.png" style="width:3in;height:3.6in" />
<figcaption><p>Figure 4.10: RBAC permission matrix for institutional roles.</p></figcaption>
</figure>

### Content Lifecycle Management

Content transitions through a managed lifecycle from draft to scheduled publication, ensuring integrity across the fleet.

### Device Management and Control Locks

A deterministic locking mechanism prevents concurrent access conflicts.

<figure>
<img src="./assets/media/fig4_12_control_lock_flow.png" style="width:5.93891in;height:3.00766in" />
<figcaption><p>Figure 4.11: Control lock acquisition and rejection flow.</p></figcaption>
</figure>

### Signage Deployment Engine

The deployment engine orchestrates multi-layered content based on temporal windows and priority-based scheduling.

### Media Processing Pipeline

Automated pipelines handle hardware-accelerated transcoding and optimization for images, videos, and documents.

<figure>
<img src="./assets/media/fig4_14_media_pipeline.png" style="width:5.83333in;height:1.75566in" />
<figcaption><p>Figure 4.12: Automated media processing and optimization pipeline.</p></figcaption>
</figure>

### Live Stream Relay

A server-side relay pipeline supports multiple source types at zero licensing cost.

<caption>Table 4.6: Stream types and relay architecture.</caption>
| Type | Source | Relay Mechanism |
|----|----|----|
| HLS/RTMP/RTSP | Mixed | FFmpeg-driven HLS segment serving |

<figure>
<img src="./assets/media/fig3_4_stream_relay.png" style="width:5.83333in;height:0.45205in" />
<figcaption><p>Figure 4.13: Stream relay pipeline architecture.</p></figcaption>
</figure>

### Emergency Broadcast System

A multi-trigger system unifies physical hardware interrupts with global real-time protocol propagation.

<figure>
<img src="./assets/media/fig4_13_emergency_states.png" style="width:5.83333in;height:2.95173in" />
<figcaption><p>Figure 4.14: Emergency broadcast state machine and transition logic.</p></figcaption>
</figure>

### Socket.IO Real-Time Bus

Persistent bidirectional communication ensures sub-second command propagation and health monitoring.

### Fault Tolerance and Race Condition Handling

The system incorporates ACID transactions and priority-based conflict resolution to handle concurrent high-load scenarios.

### AI-Assisted Public Engagement

An integrated AI layer facilitates public engagement based on the institutional context of the signage content.

## Frontend and User Interface

The management platform provides a sophisticated, reactive UI for administrators and creators. (Figures 4.15-4.26 illustrate the diverse dashboard views and interactive designer tools).

## Dual Player Architecture

The system supports multiple playback backends to optimize for diverse hardware and content requirements.

<caption>Table 4.7: Comparative analysis of dual playback backends.</caption>
| Feature | Web-Based Player | Native Player |
|----|----|----|
| Content Support | Full HTML/CSS/JS | Hardware-accelerated Video |
| Resource Load | Medium-High | Low-Optimized |

## Security Implementation

### Threat Model

We identified four trust boundaries and mapped corresponding attack surfaces across the infrastructure.

<figure>
<img src="./assets/media/fig6_1_attack_surface.png" style="width:5.83333in;height:1.28618in" />
<figcaption><p>Figure 4.27: System-wide threat model and trust boundaries.</p></figcaption>
</figure>

### Vulnerabilities Addressed

Twelve critical and high-severity vulnerabilities were remediated through systematic hardening.

<caption>Table 4.8: Security vulnerability inventory and remediation.</caption>
| ID | Severity | Remediation Strategy |
|----|----|----|
| V-01 - V-04 | Critical | Handshake auth, Rate limiting, Path traversal protection. |
| V-05 - V-09 | High | JWT rotation, Origin validation, CSP enforcement. |

<figure>
<img src="./assets/media/fig6_2_socket_auth.png" style="width:7.30918in;height:8.33763in" />
<figcaption><p>Figure 4.28: Secure handshake and device authentication implementation.</p></figcaption>
</figure>

### Network Hardening

Production-grade firewall rules and TLS 1.3 encryption were enforced across all communication channels.

### Remediation Summary

The final system posture contains zero known critical or high-severity vulnerabilities, ensuring a production-ready security environment.

## Chapter Summary

This chapter detailed the implementation of the Smart Digital Signage 
System, demonstrating a robust, validated infrastructure ready for deployment.

\newpage
