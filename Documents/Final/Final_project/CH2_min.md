#  Chapter 2 {.title}

# Literature Review and Related Work

This chapter establishes the theoretical and empirical foundations for 
the Smart Digital Signage System by surveying seven critical domains: 
distributed communication frameworks, human-computer interaction (HCI) 
for public displays, IoT edge computing architectures, perceptual power 
management, live streaming protocols, and multi-tenant security models. 

## Theoretical Framework

### Information Dissemination Theory

The system's content delivery model is grounded in Shannon-Weaver Communication Theory,
which models communication as a source — encoder — channel — decoder — receiver pipeline.
In our system, the content creator serves as the source, the design pipeline acts as the encoder, the communication transport over the isolated network forms the channel, the media player on each node acts as the decoder, and the end-user viewing the display is the receiver. 

### Human-Computer Interaction Principles for Public Displays

The interface design follows the Attention-Interest-Desire-Action (AIDA) model adapted
for passive display consumption. Attention is captured through motion-triggered wake 
states. Interest is maintained through content rotation with urgency-based priority 
ordering. Desire is created through visually rich designed posts ensuring readability 
on any display size. 

### Adaptive Control Systems Theory

The brightness adjustment loop implements a closed-loop feedback control system where the LDR sensor measures ambient illuminance, the controller maps this reading to a backlight level using logarithmic Weber-Fechner mapping, the actuator adjusts the display brightness, and the sensor re-reads periodically to provide continuous feedback that maintains perceptual brightness stability.

## Conceptual Framework

The conceptual framework maps system components to theoretical constructs from the literature:

<caption>Table 2.1: Mapping theoretical constructs to system implementation.</caption>
| Theoretical Construct | System Component | Production-Ready Implementation |
| --- | --- | --- |
| Information Dissemination | Distributed Pipeline | Multi-stage asset reconciliation and edge sync |
| Access Control (RBAC) | Security Architecture | Group-scoped multi-tenancy with device tokens |
| Edge Computing | Distributed Logic | Local content caching with 72-hour resilience |
| Feedback Control | Perceptual Brightness | Closed-loop sensor-driven Weber-Fechner mapping |
| Emergency Orchestration | Priority Broadcast | Hybrid hardware/software global override path |
| Network Hardening | Subnet Isolation | Dual-NIC Layer-3 architecture with default-deny |

## Digital Signage Platforms

### Open-Source Solutions

We surveyed the open-source digital signage landscape to understand the
capabilities and limitations of existing platforms. Systems such as **Anthias** and **Xibo** 
provide robust media rotation but exhibit critical gaps in environmental awareness, granular governance, and device security.

### Commercial Enterprise Systems

We evaluated the Total Cost of Ownership (TCO) for major commercial platforms (Yodeck, NoviSign, Rise Vision, ScreenCloud). Our analysis reveals significant annual operating deficits for large-scale deployments without providing custom sensor integration or network sovereignty.

<caption>Table 2.2: Commercial Digital Signage Platform comparison.</caption>
| Platform | Monthly Cost/Screen | Annual Cost (130 screens) | 5-Year TCO | Sensor Integration | On-Premises | RBAC | Live Stream |
|----|----|----|----|----|----|----|----|
| Yodeck | $13.99 | $21,824 | $109,120 | No | No | No | No |
| NoviSign | $30.00 | $46,800 | $234,000 | No | No | No | No |
| Rise Vision | $12.00 | $18,720 | $93,600 | No | No | No | No |
| ScreenCloud | $20.00 | $31,200 | $156,000 | No | No | No | No |
| Our System | $0.00 | $0 | $118,000 (est.) | **Yes** | **Yes** | **Yes** | **Yes** |

## Research Gaps Identified

Our survey revealed seven critical capabilities that no existing platform 
combines: zero licensing cost, environmental sensor integration, role-based 
access control with group scoping, device token authentication, 
campus-scale network security design, a dual player architecture, and 
integrated live streaming at zero cost. 

## IoT and Edge Computing for Building Automation

### Raspberry Pi as Edge Node

The Raspberry Pi 4B is an attractive edge node for digital signage due to 
its sufficient compute for content decoding, network connectivity, and 
GPIO pins for sensor interfacing. 

### Arduino-Based Sensor Acquisition

The Arduino Mega 2560 is ideal for real-time sensor polling. Our design 
assigns the Arduino to dedicated real-time environmental sampling while the 
main node handles networking and playback. 

### Serial Communication Protocols

We evaluated various serial protocols (USB CDC, UART, I2C, SPI) for the Pi-Arduino link, selecting USB CDC for its plug-and-play capability and driver stability.

<caption>Table 2.3: Serial protocol comparison for the Pi-Arduino data link.</caption>
| Protocol | Wiring | Hot-Plug | Driver Support | Selected |
|----|----|----|----|----|
| USB CDC | 1 cable | Yes | Native | **Yes** |
| UART | 3 wires | No | Native | No |
| I2C | 2 wires | No | Native | No |
| SPI | 4 wires | No | Native | No |

## Power Management in Display Systems

### Ambient Light Sensors for Brightness Adaptation

Existing research has demonstrated that attaching external light sensors to 
displays can reduce power consumption by 18-35%. Our system improves on this by integrating
sensing directly into the CMS.

### Psychophysical Basis: The Weber-Fechner Law

The human visual system perceives brightness on a logarithmic scale. 
Our implementation uses this mathematical relationship to produce smooth 
perceptual transitions and yield additional energy savings at low light 
levels.

<figure>
<img src="./assets/media/fig2_3_brightness_curve.png"
style="width:5.83333in;height:4.16667in" />
<figcaption><p>Figure 2.3: Logarithmic brightness adaptation curve based on the Weber-Fechner law.</p></figcaption>
</figure>

### CEC and DDC/CI Protocols for Display Control

We evaluated two industry-standard protocols (CEC and DDC/CI) for programmatic display
control, ensuring compatibility across a wide range of commercial displays.

## Live Streaming in Digital Signage

### RTMP Ingest and HLS Distribution

We utilize industry-standard protocols for ingest and distribution, performing server-side transcoding to ensure high reliability and compatibility.

### Existing Platform Streaming Capabilities

Our survey revealed that existing platforms offer limited or costly streaming support. Our approach integrates RTMP-to-HLS relay at zero additional cost.

## Multi-Tenancy and Role-Based Access Control

### IoT Multi-Tenancy Literature

We identified key patterns for tenant isolation (data, network, compute) and mapped them to organizational functions to ensure least privilege.

### Campus Network Security for IoT

Isolating IoT devices on dedicated subnets reduces the attack surface significantly, informing our dual-NIC Layer 3 isolation design.

## Research Gaps Summary

<caption>Table 2.4: Research gaps addressed by the project.</caption>
| # | Research Gap | Implementation Feature |
|----|----|----|
| 1 | No open-source platform combines sensing, CMS, and RBAC | Unified system architecture |
| 2 | No platform integrates light sensing with content management | Sensor-driven adaptive brightness |
| 3 | No device token authentication for edge nodes | Secure per-device tokens |
| 4 | No campus-scale network security design | Layer 3 isolation and hardening |
| 5 | No open-source streaming at zero cost | Server-side relay pipeline |
| 6 | No emergency broadcast with hardware trigger | Multi-trigger emergency system |
| 7 | No concurrency control for multi-user access | Priority-based control locks |

## Chapter Summary

This chapter reviewed the theoretical and empirical foundations of digital signage, IoT edge computing, and power management. By comparing existing platforms, we identified critical research gaps that our system is designed to fill.

\newpage
