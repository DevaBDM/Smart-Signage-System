#  Appendices {.title}

Supplementary material supporting the Smart Digital Signage System
chapters.

## Appendix A - Database Entity-Relationship Diagram {.subtitle}

<figure>
<img src="./assets/media/fig_prisma_erd.png"
style="width:5.83333in;height:3.25085in" />
<figcaption><p>Prisma Schema Entity-Relationship Diagram.</p></figcaption>
</figure>

The system utilizes a normalized relational database schema comprising 15+ 
interlinked models to ensure data integrity and scalable orchestration.

## Appendix B - Complete REST API Endpoint Reference {.subtitle}

The backend exposes a secure REST API for authentication, fleet management, and 
content orchestration.

<caption>REST API endpoint summary.</caption>
| Category | Endpoint Scope |
|----|----|
| Authentication | User and device-level cryptographic handshaking. |
| Management | CRUD operations for groups, users, and device fleets. |
| Orchestration | Content deployment, scheduling, and priority control. |
| Media | Hardware-accelerated optimization and processing. |

## Appendix C - Socket.IO Event Protocol Reference {.subtitle}

Real-time bidirectional communication is managed through a specialized 
Socket.IO event protocol.

<caption>Core Socket.IO event summary.</caption>
| Direction | Event Examples |
|----|----|
| Device → Server | `heartbeat`, `sensor_update`, `emergency_trigger`. |
| Server → Device | `signage_command`, `emergency_mode_start`, `refresh_display`. |

## Appendix D - Arduino Firmware (`sensors.ino`) {.subtitle}

<figure>
<img src="./assets/media/code_sensors_ino.png" style="width:5in;height:3in" />
<figcaption><p>Embedded firmware for real-time sensor acquisition.</p></figcaption>
</figure>

The firmware implements a deterministic 2Hz loop for high-frequency 
environmental sampling and packetized transmission.

## Appendix E - Raspberry Pi Agent Configuration (`config.py`) {.subtitle}

<figure>
<img src="./assets/media/code_config_py.png" style="width:5in;height:3in" />
<figcaption><p>Display agent configuration and environment management.</p></figcaption>
</figure>

Per-node configuration enables tailored behavior for diverse institutional 
environments.

## Appendix F - Prisma Schema Excerpt (Key Models) {.subtitle}

<figure>
<img src="./assets/media/code_prisma_schema.png" style="width:4in;height:3in" />
<figcaption><p>Normalized database schema definitions.</p></figcaption>
</figure>

## Appendix G - Network Configuration Files {.subtitle}

The network infrastructure is hardened using production-grade 
configuration for local DNS, DHCP, and Layer-3 isolation.

## Appendix H - Frontend Component Hierarchy {.subtitle}

The management platform follows a sophisticated component-driven architecture 
ensuring a reactive and consistent user experience.

## Appendix I - Systemd Service Units {.subtitle}

Display nodes utilize a suite of managed systemd services to ensure 24/7 
operational stability.

## Appendix J - Security Vulnerability Detail Cards {.subtitle}

Twelve high-severity vulnerabilities were identified and remediated through 
the engineering lifecycle.

<caption>Security hardening inventory.</caption>
| Severity | Count | Status |
|----|----|----|
| Critical (P0) | 4 | **Closed** |
| High (P1) | 5 | **Closed** |

## Appendix K - Risk Register {.subtitle}

A comprehensive risk register outlines institutional mitigation strategies 
for infrastructure, hardware, and security domains.

## Appendix L - Glossary of Terms {.subtitle}

<caption>Technical glossary of terms.</caption>
| Term | Definition |
|----|----|
| **Anthias** | Docker-based digital signage player for rich HTML content. |
| **CEC / DDC/CI** | Standard protocols for programmatic display control. |
| **FFmpeg** | High-performance multimedia processing framework. |
| **HLS / RTMP** | Professional streaming protocols for media distribution. |
| **RBAC** | Role-Based Access Control model for institutional governance. |
| **Socket.IO** | Real-time bidirectional communication engine. |
| **Weber-Fechner** | Basis for the system's human-centric brightness adjustment. |

\newpage
