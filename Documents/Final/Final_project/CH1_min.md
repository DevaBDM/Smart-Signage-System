#  Chapter 1 {.title}

# Introduction

This chapter establishes the foundation for the Smart Digital Signage
System by examining the evolution of campus communication infrastructure,
identifying the limitations of existing commercial and open-source
solutions, and formally stating the problems this project addresses. We
present the general and specific objectives, define the scope of the
study, and highlight the significance and contributions of this work.

## Background and Motivation

### Evolution of Campus Communication

The transition from paper-based bulletin boards to electronic displays
represents one of the most visible manifestations of digital
transformation in educational and institutional environments. For
decades, universities, hospitals, and corporate campuses relied on
static printed notices posted on physical boards - a medium that was
inexpensive to deploy but fundamentally limited in reach, timeliness,
and adaptability [1]. Messages required manual replacement, could not
be updated remotely, offered no targeting by audience or location, and
provided no mechanism for emergency broadcast.

The advent of liquid-crystal and light-emitting diode (LED) display
panels, combined with falling hardware costs and ubiquitous network
connectivity, has enabled a generational shift toward digital signage.
Modern campuses now deploy dozens to hundreds of electronic displays
across buildings, corridors, courtyards, and parking areas, showing
everything from class schedules and event announcements to cafeteria
menus and emergency alerts [2]. These displays are typically managed
through networked media players that download content from a central
server and render it on high-definition screens ranging from 32 inches
in elevators to 85 inches in atriums.

Despite this technological progress, the operational model of most
campus digital signage systems remains strikingly static. Displays are
turned on in the morning and off in the evening, running at a fixed
brightness level calibrated for worst-case viewing conditions. Content
schedules are set manually and updated infrequently. Each display or
small cluster operates as an isolated unit with limited awareness of its
physical environment or the presence of viewers. The result is a system
that consumes significant electrical energy while delivering messages
that may be irrelevant to the current audience or even invisible due to
glare from changing ambient light [3].

<figure>
<img src="./assets/media/fig1_1_bulletin_board.jpg"
style="width:5.83333in;height:2.72079in" />
<figcaption><p>Traditional campus bulletin board with paper notices.</p></figcaption>
</figure>

### Limitations of Current Commercial and Open-Source Digital Signage

The digital signage market offers two primary categories of solutions:
proprietary commercial platforms and open-source alternatives.
Commercial systems such as Screenly, Xibo, and Scala provide polished
management dashboards, cloud hosting, and technical support, but impose
recurring licensing fees that can exceed $1,000 per display per year
[4]. For large-scale campus environments, this translates to $130,000 in annual
licensing alone - before hardware, installation, or energy costs.
Furthermore, commercial platforms typically offer limited or no
integration with environmental sensors, treating each display as a
passive playback endpoint rather than an intelligent node [5].

Open-source alternatives, notably Screenly OSE and its community fork
Anthias, eliminate licensing fees but introduce their own constraints.
These platforms were designed primarily for simple playlist management:
a sequence of images and videos played in rotation [6]. They lack
native support for real-time data integration, environmental
responsiveness, or role-based content governance. Administrative access
is typically binary - either full control or none - making them
unsuitable for multi-department campuses where different groups require
scoped content management authority [7].

Neither commercial nor open-source platforms adequately address three
critical operational requirements we identified through our requirements
analysis:

**Environmental responsiveness:** No major platform automatically
adjusts display brightness based on ambient light, despite the
well-documented relationship between backlight intensity and power
consumption [8]. Displays running at full brightness in dimly lit
corridors or at night waste electricity and may cause visual discomfort.

**Occupancy awareness:** Content plays regardless of whether anyone is
present. A display in an empty lecture hall at midnight consumes the
same power as one in a crowded student center at noon. This absence of
viewer detection eliminates opportunities for power savings and
contextual content adaptation [9].

**Unified emergency management:** During campus emergencies - fire,
severe weather, security incidents - individual displays cannot be
overridden with critical information without manually interrupting their
normal operation. The lack of a centralized emergency broadcast channel
represents a genuine safety gap [10].

<figure>
<img src="./assets/media/fig1_2_display_full_brightness.jpg"
style="width:5.83333in;height:2.71968in" />
<figcaption><p>Commercial display at fixed brightness in empty hallway.</p></figcaption>
</figure>

### The Convergence Opportunity

The emergence of low-cost microcontrollers, single-board computers, and
high-bandwidth campus networks creates an unprecedented opportunity to
reimagine digital signage as an intelligent building automation system
rather than a passive media playback infrastructure. The Arduino Mega
2560, Raspberry Pi 4B, and ultrasonic sensing technology make it 
economically feasible to instrument every display node with environmental 
sensing [11]. The proliferation of 1 Gbps wired Ethernet and managed 
switches enables real-time data collection from hundreds of nodes without 
congestion [12]. Modern JavaScript frameworks (React, Node.js) and 
containerization (Docker) reduce the engineering effort required to build 
production-grade management platforms [13].

## Problem Statement

The investigation of existing campus-scale digital signage implementations has identified several critical problems that impede efficient communication and resource management.

### Evidence from Local Field Observations

To ground the problem statement in empirical evidence, a field survey was conducted through direct observation of existing digital notice boards in Woldia City. This study confirmed several systemic failures in current implementations:
- **Excessive Brightness:** Boards were found to operate at 100% luminance regardless of ambient light conditions, causing significant visual glare at night and substantial energy waste.
- **Management Errors:** The displays exhibited unmanaged operational states, including frozen content and system errors, demonstrating a lack of remote monitoring and automated recovery.
- **Information Lag:** Content was frequently outdated, confirming that existing processes for information dissemination are slow and inefficient due to the lack of a centralized platform.

### Identified Challenges

- **Energy waste from fixed-brightness operation:** Digital displays consume between 30 and 150 W per unit. In large-scale institutional deployments, such as 130 displays operating 16 hours daily, fixed-brightness operation results in an estimated annual energy consumption of 95,600 kWh and electricity costs exceeding $11,400.
- **Disconnected and unmanaged display nodes:** Display infrastructure often operates as a collection of isolated units with no awareness of their physical surroundings or connection to a central authority.
- **Security vulnerabilities in unauthenticated communication:** Communication between signage nodes and servers often occurs without cryptographic authentication.
- **Prohibitive Total Cost of Ownership (TCO):** Commercial licensing and support for enterprise signage platforms can exceed $1,000 per display per year.

## Objective

### General Objective

To design, implement, and validate an open-source Smart Digital Signage
System that integrates environmental sensing, centralized content
management with role-based access control (RBAC), real-time device
command and control, live stream distribution, emergency broadcast with
hardware trigger, and a hardened campus network - replacing costly
commercial alternatives with a functional, tested prototype.

<figure>
<img src="./assets/media/Core Diagram.png"
style="width:6in;height:4.5in" />
<figcaption><p>Figure 1.3: Smart Digital Signage System Core Architecture Overview.</p></figcaption>
</figure>

### Specific Objectives

1.  **Develop an embedded sensing layer:** Implement a sensor bridge using an Arduino Mega 2560 with motion, ambient light, and emergency button inputs. 
2.  **Build a centralized full-stack CMS:** Create a management platform with role-based access control (RBAC), group-scoped permissions, and real-time device control.
3.  **Implement live stream distribution:** Deploy a media relay pipeline supporting HLS, RTSP, YouTube, and RTMP ingest at zero licensing cost.
4.  **Design a dual player architecture:** Engineer a unified control layer supporting both web-based and native-media playback engines with per-device backend selection.
5.  **Deploy a secure campus network design:** Implement a production-ready network topology using the 10.20.0.0/22 subnet with dual-NIC Layer 3 isolation and network hardening.
6.  **Build an emergency broadcast system:** Develop a multi-trigger emergency system with hardware buttons, group-wide overrides, and automatic local fallback.
7.  **Implement robust concurrency control:** Design a control-lock mechanism with priority synchronization and deadlock prevention for multi-user access.
8.  **Validate the system through comprehensive testing:** Conduct automated software testing and hardware verification protocols.


## Scope and Delimitations

### Geographical Scope

The system is designed for deployment at **Woldia University (Main Campus)**, targeting a scalable architecture supporting up to 130+ nodes across academic buildings, open areas, and administrative centers. 

### User Scope

Three user categories are supported:
- **Administrators:** IT staff who manage devices, groups, and user accounts.
- **Content Creators:** Departmental staff who publish content to assigned display groups.
- **Public Viewers:** Students, faculty, and visitors who browse the public feed.

### Functional Scope

The system covers embedded sensing, content management, role-based access control, real-time device control, live streaming, emergency broadcast, and a public feed with AI assistance.

### Period of Study

The study was conducted over an eight-month period from November 2025 to June 2026.

### In scope

Design and implementation of the core CMS, hardware sensor bridge prototype, dual-player display agent, and secure network architecture.

### Out of scope

Full physical deployment across all campus buildings and long-term environmental measurements are reserved for future work.

### Justification

These delimitations focus the project on proving the technical feasibility and architectural robustness of the system within the available timeframe and resources.

## Significance of the Study

The significance of this project lies in its delivery of a validated, 
enterprise-grade alternative to proprietary signage ecosystems. 

### Scientific and Technical Contributions

- **Perceptual Power Optimization:** Real-time control loop mapping environmental lux levels to display intensity.
- **Hardware-Software Hybrid Security:** Cryptographic device-token model combined with Layer-3 isolation.
- **Integrated Emergency Orchestration:** Low-latency broadcast system unifying local and global triggers.
- **Economic Sustainability Framework:** Proof-of-concept for a 100% open-source institutional stack.

### Practical Impact

Institutions gain a self-managed, secure, and energy-efficient display infrastructure with a 60% reduction in five-year total cost of ownership.

## Organization of the report

The remainder of this report is organized as follows:

- **Chapter 2 - Literature Review and Related Work:** Surveys foundations, platforms, and related research.
- **Chapter 3 - Methodology:** Details the DBR framework, requirements, and architecture.
- **Chapter 4 - System Design and Implementation:** Presents the technical implementation of all system layers.
- **Chapter 5 - Results and Empirical Validation:** Documents the findings from all verification protocols.
- **Chapter 6 - Discussion:** Evaluates how the implementation resolves the core research problems.
- **Chapter 7 - Conclusion and Future Work:** Summarizes contributions and outlines the roadmap.

## Chapter Summary

This chapter established the foundational motivation for the project, highlighting the critical gaps in energy efficiency, security, and economic sustainability within current signage solutions. 

\newpage
