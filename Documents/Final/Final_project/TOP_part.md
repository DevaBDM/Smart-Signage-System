<img src="./assets/media/image1.jpeg"
style="width:2.26744in;height:1.33705in"
alt="Courses | Woldia University" />

**WOLDIA UNIVERSITY**

**INSTITUTE OF TECHNOLOGY**

**SCHOOL OF ELECTRICAL AND COMPUTER ENGINEERING**

**COMPUTER ENGINEERING STREAM**

**TITLE: DESIGN AND IMPLEMENTATION OF SMART SIGNAGE SYSTEM FOR THE
PURPOSE OF ORGANIZATIONAL INFORMATION DISCRIMINATION**

**PREPARED BY:**

> **GROUP NAME ID NO**

1.  **DAWIT BERHAN WDU1304696**

2.  **CHARAKA WAKSHUM WDU1300748**

3.  **ARSEMA DANIEL WDU1300391**

**ACADEMIC ADVISOR ALI Y. (MSc.)**

**SUBMITTED TO: ECE Department**

**SUBMITTED DATE 20/09/2018 E.C.**

**WOLDIA, ETHIOPIA**

# Declaration

Here by, declare that the work entitles design and implementation of
smart signage system for the purpose of organizational information
discrimination is our original work, we have not copied from any other
student’s work or from any other source except where due reference or
acknowledgment is made explicitly in the text, nor has any part been
written for us by another person.

**Student’s Name** **Signature**

Dawit Berhan \_\_\_\_\_\_\_\_\_\_

Chereka Wakshum \_\_\_\_\_\_\_\_\_\_

Arsema Daniel \_\_\_\_\_\_\_\_\_\_

**Advisor’s Approval**

The project has been submitted for examination with approval as a
university advisor.

**Advisor’s Name Signature Date**

**Mr. Ali Yimam (MSc.) \_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_**

**Examiner Committee Signature Date**

1\. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_

2\. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_

3\. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_

# Acknowledgements

We would like to express our sincere gratitude to our advisor, Mr. Ali
Y, for the guidance, encouragement, and technical insight provided
throughout this capstone project. His feedback at every milestone was
instrumental in shaping both the architecture and the presentation of
our work.

We thank the Department of Electrical and Computer Engineering for
providing the laboratory facilities and equipment that enabled us to
assemble and test the sensor hardware prototype. We also acknowledge our
fellow students and peers whose discussions and suggestions refined our
design decisions.

This project was completed collaboratively by three final-year students
working as a group. All system design, hardware assembly, software
development, testing, and documentation were shared responsibilities,
with each member contributing to every subsystem.

# Abstract

Modern organizations rely on digital signage for information
dissemination, yet existing solutions suffer from four critical gaps:
displays operate at fixed brightness regardless of ambient conditions,
each node is managed independently without unified control, IoT devices
receive content without authentication, and commercial platforms impose
prohibitive licensing costs exceeding \$1,000 per display annually. This
capstone project addresses these gaps through the design and
implementation of a Smart Digital Signage System that integrates
environmental sensing, role-based content management, real-time device
control, live stream distribution, and security-hardened network
infrastructure.

We assembled an Arduino Mega 2560 sensor bridge with three HC-SR04
ultrasonic distance sensors, a light-dependent resistor, a
potentiometer, and an emergency push button on a solderless breadboard.
Two laptops running Debian 13 live USB sessions simulated Raspberry Pi
edge nodes, with their screens serving as the digital signage displays.
The Arduino transmitted sensor data over USB serial at 9600 baud to the
Debian nodes, enabling real-time adaptive brightness control via the
operating system’s brightness API, occupancy detection for contextual
content scheduling, and an emergency broadcast system triggered by a
hardware push button.

The backend was implemented in Node.js with Express.js, using Prisma ORM
with PostgreSQL for data persistence, Socket.IO for real-time device
command and control, and FFmpeg with Sharp for media processing. The
frontend was built in React 19 with Vite, featuring role-based
dashboards for administrators and content creators, a public feed with
AI-assisted Q&A, and a dual-designer architecture supporting both visual
(Fabric.js) and textual (Markdown + KaTeX) content creation.

Validation comprised 30+ backend integration tests using Jest and
Supertest, 25 frontend end-to-end tests using Playwright producing 55
screenshots, and hardware verification confirming sensor data accuracy,
serial communication stability, and end-to-end brightness adaptation.
Our cost analysis projects a 60% total cost of ownership reduction
compared to commercial alternatives over a five-year deployment horizon.

**Keywords:** digital signage, IoT, environmental sensing, adaptive
brightness, RBAC, Raspberry Pi, Arduino, Socket.IO, live streaming,
campus network, emergency broadcast, full-stack development

# Table of Contents

[Declaration [i](#declaration)](#declaration)

[Acknowledgements [ii](#acknowledgements)](#acknowledgements)

[Abstract [iii](#abstract)](#abstract)

[List of Figures [xi](#list-of-figures)](#list-of-figures)

[List of Tables [xv](#list-of-tables)](#list-of-tables)

[Acronyms and Abbreviations
[xvi](#acronyms-and-abbreviations)](#acronyms-and-abbreviations)

[Chapter 1 [1](#chapter-1)](#chapter-1)

[1 Introduction [1](#introduction)](#introduction)

[1.1 Background and Motivation
[1](#background-and-motivation)](#background-and-motivation)

[1.1.1 Evolution of Campus Communication
[1](#evolution-of-campus-communication)](#evolution-of-campus-communication)

[1.1.2 Limitations of Current Commercial and Open-Source Digital Signage
[2](#limitations-of-current-commercial-and-open-source-digital-signage)](#limitations-of-current-commercial-and-open-source-digital-signage)

[1.1.3 The Convergence Opportunity
[3](#the-convergence-opportunity)](#the-convergence-opportunity)

[1.2 Problem Statement [4](#problem-statement)](#problem-statement)

[1.3 Objective [5](#objective)](#objective)

[1.3.1 General Objective [5](#general-objective)](#general-objective)

[1.3.2 Specific Objectives
[5](#specific-objectives)](#specific-objectives)

[1.4 Scope and Delimitations
[6](#scope-and-delimitations)](#scope-and-delimitations)

[1.4.1 In scope [6](#in-scope)](#in-scope)

[1.4.2 Out of scope [6](#out-of-scope)](#out-of-scope)

[1.4.3 Justification [7](#justification)](#justification)

[1.5 Significance and Contributions
[7](#significance-and-contributions)](#significance-and-contributions)

[1.5.1 Why This Matters [7](#why-this-matters)](#why-this-matters)

[1.5.2 Novel Contributions
[7](#novel-contributions)](#novel-contributions)

[1.5.3 Who Benefits [8](#who-benefits)](#who-benefits)

[1.6 Report Structure [8](#report-structure)](#report-structure)

[Chapter 2 [10](#chapter-2)](#chapter-2)

[2 Literature Review and Related Work
[10](#literature-review-and-related-work)](#literature-review-and-related-work)

[2.1 Digital Signage Platforms
[10](#digital-signage-platforms)](#digital-signage-platforms)

[2.1.1 Open-Source Solutions
[10](#open-source-solutions)](#open-source-solutions)

[2.1.2 Commercial Enterprise Systems
[11](#commercial-enterprise-systems)](#commercial-enterprise-systems)

[2.1.3 Research Gaps Identified
[12](#research-gaps-identified)](#research-gaps-identified)

[2.2 IoT and Edge Computing for Building Automation
[13](#iot-and-edge-computing-for-building-automation)](#iot-and-edge-computing-for-building-automation)

[2.2.1 Raspberry Pi as Edge Node
[13](#raspberry-pi-as-edge-node)](#raspberry-pi-as-edge-node)

[2.2.2 Arduino-Based Sensor Acquisition
[13](#arduino-based-sensor-acquisition)](#arduino-based-sensor-acquisition)

[2.2.3 Serial Communication Protocols
[14](#serial-communication-protocols)](#serial-communication-protocols)

[2.3 Power Management in Display Systems
[15](#power-management-in-display-systems)](#power-management-in-display-systems)

[2.3.1 Ambient Light Sensors for Brightness Adaptation
[15](#ambient-light-sensors-for-brightness-adaptation)](#ambient-light-sensors-for-brightness-adaptation)

[2.3.2 Psychophysical Basis: The Weber-Fechner Law
[15](#psychophysical-basis-the-weber-fechner-law)](#psychophysical-basis-the-weber-fechner-law)

[2.3.3 CEC and DDC/CI Protocols for Display Control
[17](#cec-and-ddcci-protocols-for-display-control)](#cec-and-ddcci-protocols-for-display-control)

[2.4 Live Streaming in Digital Signage
[17](#live-streaming-in-digital-signage)](#live-streaming-in-digital-signage)

[2.4.1 RTMP Ingest and HLS Distribution
[17](#rtmp-ingest-and-hls-distribution)](#rtmp-ingest-and-hls-distribution)

[2.4.2 Existing Platform Streaming Capabilities
[18](#existing-platform-streaming-capabilities)](#existing-platform-streaming-capabilities)

[2.5 Multi-Tenancy and Role-Based Access Control
[18](#multi-tenancy-and-role-based-access-control)](#multi-tenancy-and-role-based-access-control)

[2.5.1 IoT Multi-Tenancy Literature
[18](#iot-multi-tenancy-literature)](#iot-multi-tenancy-literature)

[2.5.2 Campus Network Security for IoT
[19](#campus-network-security-for-iot)](#campus-network-security-for-iot)

[2.6 Research Gaps Summary
[19](#research-gaps-summary)](#research-gaps-summary)

[Chapter 3 [21](#chapter-3)](#chapter-3)

[3 Methodology [21](#methodology)](#methodology)

[3.1 Research Approach [21](#research-approach)](#research-approach)

[3.2 System Requirements
[22](#system-requirements)](#system-requirements)

[3.2.1 Functional Requirements
[22](#functional-requirements)](#functional-requirements)

[3.2.2 Non-Functional Requirements
[23](#non-functional-requirements)](#non-functional-requirements)

[3.3 High-Level Architecture
[24](#high-level-architecture)](#high-level-architecture)

[3.3.1 End-to-End Data Flow
[25](#end-to-end-data-flow)](#end-to-end-data-flow)

[3.3.2 Component Count and Scale
[26](#component-count-and-scale)](#component-count-and-scale)

[3.4 Development and Testing Methodology
[27](#development-and-testing-methodology)](#development-and-testing-methodology)

[3.4.1 Iterative Development Process
[27](#iterative-development-process)](#iterative-development-process)

[3.4.2 Testing Strategy [27](#testing-strategy)](#testing-strategy)

[3.4.3 Development Tooling
[28](#development-tooling)](#development-tooling)

[Chapter 4 [30](#chapter-4)](#chapter-4)

[4 System Design and Implementation
[30](#system-design-and-implementation)](#system-design-and-implementation)

[4.1 Hardware Implementation
[30](#hardware-implementation)](#hardware-implementation)

[4.1.1 Component Selection and Specifications
[30](#component-selection-and-specifications)](#component-selection-and-specifications)

[4.1.2 Physical Assembly and Wiring
[31](#physical-assembly-and-wiring)](#physical-assembly-and-wiring)

[4.1.3 Sensor Fusion and Preprocessing
[33](#sensor-fusion-and-preprocessing)](#sensor-fusion-and-preprocessing)

[4.1.4 Adaptive Brightness Algorithm
[34](#adaptive-brightness-algorithm)](#adaptive-brightness-algorithm)

[4.1.5 Simulated Edge Node Software
[35](#simulated-edge-node-software)](#simulated-edge-node-software)

[4.1.6 Systemd Service Configuration
[35](#systemd-service-configuration)](#systemd-service-configuration)

[4.2 Network and Infrastructure Design
[36](#network-and-infrastructure-design)](#network-and-infrastructure-design)

[4.2.1 Subnet Design [36](#subnet-design)](#subnet-design)

[4.2.2 Layer 3 Isolation with Dual-NIC Server
[37](#layer-3-isolation-with-dual-nic-server)](#layer-3-isolation-with-dual-nic-server)

[4.2.3 Core Services [38](#core-services)](#core-services)

[4.2.4 Bandwidth Engineering
[39](#bandwidth-engineering)](#bandwidth-engineering)

[4.2.5 Failure Modes and Resilience
[39](#failure-modes-and-resilience)](#failure-modes-and-resilience)

[4.2.6 Security Hardening at the Network Layer
[40](#security-hardening-at-the-network-layer)](#security-hardening-at-the-network-layer)

[4.3 Backend System Implementation
[40](#backend-system-implementation)](#backend-system-implementation)

[4.3.1 Layered Architecture
[40](#layered-architecture)](#layered-architecture)

[4.3.2 Database Design [41](#database-design)](#database-design)

[4.3.3 Authentication and Authorization
[42](#authentication-and-authorization)](#authentication-and-authorization)

[4.3.4 User and Group Management
[43](#user-and-group-management)](#user-and-group-management)

[4.3.5 Content Lifecycle Management
[44](#content-lifecycle-management)](#content-lifecycle-management)

[4.3.6 Device Management and Control Locks
[45](#device-management-and-control-locks)](#device-management-and-control-locks)

[4.3.7 Signage Deployment Engine
[46](#signage-deployment-engine)](#signage-deployment-engine)

[4.3.8 Media Processing Pipeline
[47](#media-processing-pipeline)](#media-processing-pipeline)

[4.3.9 Live Stream Relay [48](#live-stream-relay)](#live-stream-relay)

[4.3.10 Emergency Broadcast System
[48](#emergency-broadcast-system)](#emergency-broadcast-system)

[4.3.11 Socket.IO Real-Time Bus
[49](#socket.io-real-time-bus)](#socket.io-real-time-bus)

[4.3.12 Fault Tolerance and Race Condition Handling
[50](#fault-tolerance-and-race-condition-handling)](#fault-tolerance-and-race-condition-handling)

[4.3.13 AI-Assisted Public Engagement
[50](#ai-assisted-public-engagement)](#ai-assisted-public-engagement)

[4.4 Frontend and User Interface
[50](#frontend-and-user-interface)](#frontend-and-user-interface)

[4.4.1 Admin Dashboard [51](#admin-dashboard)](#admin-dashboard)

[4.4.2 Creator Dashboard [53](#creator-dashboard)](#creator-dashboard)

[4.4.3 Public Feed and Viewer Interface
[57](#public-feed-and-viewer-interface)](#public-feed-and-viewer-interface)

[4.4.4 AI Q&A Widget [58](#ai-qa-widget)](#ai-qa-widget)

[4.4.5 Emergency Handling UI
[59](#emergency-handling-ui)](#emergency-handling-ui)

[4.4.6 State Management [60](#state-management)](#state-management)

[4.5 Dual Player Architecture
[60](#dual-player-architecture)](#dual-player-architecture)

[4.6 Security Implementation
[61](#security-implementation)](#security-implementation)

[4.6.1 Threat Model [61](#threat-model)](#threat-model)

[4.6.2 Vulnerabilities Addressed
[61](#vulnerabilities-addressed)](#vulnerabilities-addressed)

[4.6.3 Network Hardening [64](#network-hardening)](#network-hardening)

[4.6.4 Remediation Summary
[64](#remediation-summary)](#remediation-summary)

[Chapter 5 [65](#chapter-5)](#chapter-5)

[5 Results and Validation
[65](#results-and-validation)](#results-and-validation)

[5.1 Functional Testing [65](#functional-testing)](#functional-testing)

[5.1.1 Backend Integration Testing
[65](#backend-integration-testing)](#backend-integration-testing)

[5.1.2 Frontend End-to-End Testing
[66](#frontend-end-to-end-testing)](#frontend-end-to-end-testing)

[5.1.3 Test Infrastructure
[67](#test-infrastructure)](#test-infrastructure)

[5.2 Hardware Verification
[68](#hardware-verification)](#hardware-verification)

[5.2.1 Assembly Checklist
[68](#assembly-checklist)](#assembly-checklist)

[5.2.2 Power Measurement [68](#power-measurement)](#power-measurement)

[5.2.3 Serial Communication Verification
[68](#serial-communication-verification)](#serial-communication-verification)

[5.2.4 End-to-End Brightness Adaptation Test
[69](#end-to-end-brightness-adaptation-test)](#end-to-end-brightness-adaptation-test)

[5.3 Network Verification
[70](#network-verification)](#network-verification)

[5.3.1 Connectivity Tests
[70](#connectivity-tests)](#connectivity-tests)

[5.3.2 Security Verification
[70](#security-verification)](#security-verification)

[5.4 Objectives Achievement
[71](#objectives-achievement)](#objectives-achievement)

[5.5 Performance and Cost Analysis
[72](#performance-and-cost-analysis)](#performance-and-cost-analysis)

[5.5.1 Power Consumption by Component
[72](#power-consumption-by-component)](#power-consumption-by-component)

[5.5.2 Campus-Wide Energy Scenarios
[72](#campus-wide-energy-scenarios)](#campus-wide-energy-scenarios)

[5.5.3 Campus-Wide Power Distribution
[74](#campus-wide-power-distribution)](#campus-wide-power-distribution)

[5.5.4 Cost Analysis [74](#cost-analysis)](#cost-analysis)

[Chapter 6 [76](#chapter-6)](#chapter-6)

[6 Discussion [76](#discussion)](#discussion)

[6.1 How the Problems Are Solved
[76](#how-the-problems-are-solved)](#how-the-problems-are-solved)

[6.1.1 Problem P1 - Energy Waste from Fixed-Brightness Operation
[76](#problem-p1---energy-waste-from-fixed-brightness-operation)](#problem-p1---energy-waste-from-fixed-brightness-operation)

[6.1.2 Problem P2 - Disconnected, Unmanaged Display Nodes
[76](#problem-p2---disconnected-unmanaged-display-nodes)](#problem-p2---disconnected-unmanaged-display-nodes)

[6.1.3 Problem P3 - Security Gap in Unauthenticated IoT Communication
[77](#problem-p3---security-gap-in-unauthenticated-iot-communication)](#problem-p3---security-gap-in-unauthenticated-iot-communication)

[6.1.4 Problem P4 - High Total Cost of Ownership
[77](#problem-p4---high-total-cost-of-ownership)](#problem-p4---high-total-cost-of-ownership)

[6.2 Implementation Readiness
[78](#implementation-readiness)](#implementation-readiness)

[6.2.1 Production-Ready Components
[78](#production-ready-components)](#production-ready-components)

[6.2.2 Components Requiring Field Validation
[78](#components-requiring-field-validation)](#components-requiring-field-validation)

[6.3 Limitations and Assumptions
[79](#limitations-and-assumptions)](#limitations-and-assumptions)

[6.4 Comparison with Related Work
[79](#comparison-with-related-work)](#comparison-with-related-work)

[Chapter 7 [82](#chapter-7)](#chapter-7)

[7 Conclusion and Future Work
[82](#conclusion-and-future-work)](#conclusion-and-future-work)

[7.1 Conclusion [82](#conclusion)](#conclusion)

[7.2 Future Work [83](#future-work)](#future-work)

[7.2.1 Immediate Priorities (0–6 months)
[83](#immediate-priorities-06-months)](#immediate-priorities-06-months)

[7.2.2 Medium-Term Enhancements (6–18 months)
[83](#medium-term-enhancements-618-months)](#medium-term-enhancements-618-months)

[7.2.3 Research Directions (18+ months)
[84](#research-directions-18-months)](#research-directions-18-months)

[References [86](#references)](#references)

[Appendices [95](#appendices)](#appendices)

[A. Appendix A - Database Entity-Relationship Diagram
[95](#appendix-a---database-entity-relationship-diagram)](#appendix-a---database-entity-relationship-diagram)

[B. Appendix B - Complete REST API Endpoint Reference
[95](#appendix-b---complete-rest-api-endpoint-reference)](#appendix-b---complete-rest-api-endpoint-reference)

[C. Appendix C - Socket.IO Event Protocol Reference
[97](#appendix-c---socket.io-event-protocol-reference)](#appendix-c---socket.io-event-protocol-reference)

[D. Appendix D - Arduino Firmware (sensors.ino)
[98](#appendix-d---arduino-firmware-sensors.ino)](#appendix-d---arduino-firmware-sensors.ino)

[E. Appendix E - Raspberry Pi Agent Configuration (config.py)
[99](#appendix-e---raspberry-pi-agent-configuration-config.py)](#appendix-e---raspberry-pi-agent-configuration-config.py)

[F. Appendix F - Prisma Schema Excerpt (Key Models)
[100](#appendix-f---prisma-schema-excerpt-key-models)](#appendix-f---prisma-schema-excerpt-key-models)

[G. Appendix G - Network Configuration Files
[100](#appendix-g---network-configuration-files)](#appendix-g---network-configuration-files)

[H. Appendix H - Frontend Component Hierarchy
[102](#appendix-h---frontend-component-hierarchy)](#appendix-h---frontend-component-hierarchy)

[I. Appendix I - Systemd Service Units
[102](#appendix-i---systemd-service-units)](#appendix-i---systemd-service-units)

[J. Appendix J - Security Vulnerability Detail Cards
[103](#appendix-j---security-vulnerability-detail-cards)](#appendix-j---security-vulnerability-detail-cards)

[K. Appendix K - Risk Register
[103](#appendix-k---risk-register)](#appendix-k---risk-register)

[L. Appendix L - Glossary of Terms
[104](#appendix-l---glossary-of-terms)](#appendix-l---glossary-of-terms)

# List of Figures

[Figure 1‑1Traditional campus bulletin board with paper notices,
illustrating the limitations of static communication: manual updates, no
remote management, and no targeting by audience or location.
[2](#_Toc230861795)](#_Toc230861795)

[Figure 1‑2 Commercial digital signage installation showing a
fixed-brightness LCD display, illustrating energy waste and visual glare
in low ambient light conditions. [3](#_Toc230861796)](#_Toc230861796)

[Figure 1‑3 High level view of the smart signage system, with network,
device and users overview [8](#_Toc230861797)](#_Toc230861797)

[Figure 2‑1 Logarithmic brightness adaptation curve based on the
Weber-Fechner law (solid) compared with linear mapping (dashed), showing
the energy savings zone at low ambient light levels.
[16](#_Toc230861798)](#_Toc230861798)

[Figure 3‑1High-level system block diagram showing the end-to-end data
flow from sensors through Arduino, Debian edge node, Socket.IO, Node.js
backend, PostgreSQL database, and React frontend.
[24](#_Toc230861799)](#_Toc230861799)

[Figure 3‑2 Complete system topology showing 130+ Debian edge nodes,
central Ubuntu server with dual-NIC Layer 3 isolation, core and edge
switches, and campus subnet 10.20.0.0/22.
[25](#_Toc230861800)](#_Toc230861800)

[Figure 3‑3 Terminal capture of the Git log showing the last 20 commits
with Conventional Commit prefixes (feat, fix, docs, test, refactor),
demonstrating our structured commit history over the development period.
[29](#_Toc230861801)](#_Toc230861801)

[Figure 4‑1 Photograph of our assembled prototype showing the Arduino
Mega 2560 on a solderless breadboard with three HC-SR04 sensors,
connected via USB to a Debian 13 laptop.
[32](#_Toc230861802)](#_Toc230861802)

[Figure 4‑2 Sensor wiring schematic showing Arduino Mega pin assignments
for HC-SR04 (D22–D27), LDR (A0), potentiometer (A1), and emergency
button (D2). [32](#_Toc230861803)](#_Toc230861803)

[Figure 4‑3 Photograph of the sensor array mounted near the laptop
screen, showing the three HC-SR04 sensors positioned for left, center,
and right coverage. [34](#_Toc230861804)](#_Toc230861804)

[Figure 4‑4 Screenshot of the Arduino IDE Serial Monitor at 9600 baud,
showing five consecutive SENSOR: packets with motion, brightness, rain,
and emergency values. [34](#_Toc230861805)](#_Toc230861805)

[Figure 4‑5 Screenshot of the systemd status output showing
socket-signage.service as active (running), confirming automatic startup
on boot. [36](#_Toc230861806)](#_Toc230861806)

[Figure 4‑6 Network topology diagram showing the dual-NIC Ubuntu server,
core switches, edge switches, and Debian nodes in the 10.20.0.0/22
signage subnet. [38](#_Toc230861807)](#_Toc230861807)

[Figure 4‑7 Firewall rules diagram showing NIC-1 campus-facing rules
(SSH/HTTP/HTTPS/NTP) and NIC-2 signage-facing rules
(API/RTMP/HLS/DHCP/DNS). [40](#_Toc230861808)](#_Toc230861808)

[Figure 4‑8 Backend layered architecture diagram showing the data flow
from Routes through Middleware, Services, Repositories, Prisma ORM, to
PostgreSQL. [41](#_Toc230861809)](#_Toc230861809)

[Figure 4‑9 Authentication flow sequence diagram showing JWT login for
users and device token assignment for IoT nodes.
[43](#_Toc230861810)](#_Toc230861810)

[Figure 4‑10 RBAC permission matrix diagram showing the mapping of roles
(admin, creator, viewer, public) to system capabilities.
[44](#_Toc230861811)](#_Toc230861811)

[Figure 4‑11 Control lock acquisition flow sequence diagram showing
Administrator A acquiring a lock on Device 3, and Creator B receiving a
423 Locked response. [46](#_Toc230861812)](#_Toc230861812)

[Figure 4‑12 Media processing pipeline flowchart showing image
processing (Sharp), video processing (FFmpeg), and document text
extraction (mammoth/pdf-parse-fork) paths.
[47](#_Toc230861813)](#_Toc230861813)

[Figure 4‑13 Stream relay pipeline diagram showing OBS → RTMP → FFmpeg →
HLS segments → nginx → Anthias/MPV playback.
[48](#_Toc230861814)](#_Toc230861814)

[Figure 4‑14 Emergency broadcast state machine diagram showing
transitions between Normal, Emergency, Disconnected, SecurityRisk, and
BreakingNews states. [49](#_Toc230861815)](#_Toc230861815)

[Figure 4‑15 Login page with empty username and password fields, campus
branding visible; Sign In button disabled until both fields are filled.
[51](#_Toc230861816)](#_Toc230861816)

[Figure 4‑16 Admin Groups page listing all campus groups with display
state, member count, and assigned devices.
[52](#_Toc230861817)](#_Toc230861817)

[Figure 4‑17 Admin Users page showing all registered accounts with
roles, groups, and permissions [52](#_Toc230861818)](#_Toc230861818)

[Figure 4‑18 Admin Devices page showing the registered hardware fleet
with online/offline status, register form, and settings inspector.
[53](#_Toc230861819)](#_Toc230861819)

[Figure 4‑19 Creator Posts page with the new-post editor on the left and
the post list with filters on the right.
[54](#_Toc230861820)](#_Toc230861820)

[Figure 4‑20 Image cropping interface with aspect ratio locking to 16:9
for signage compatibility, drag and zoom controls visible.
[54](#_Toc230861821)](#_Toc230861821)

[Figure 4‑21 Video trimming slider used to extract specific clips before
attaching to a post, start and end handles visible.
[55](#_Toc230861822)](#_Toc230861822)

[Figure 4‑22 Creator Visual Designer with an empty Fabric.js canvas and
toolbar on the top for adding text, shapes, and images.
[55](#_Toc230861823)](#_Toc230861823)

[Figure 4‑23 Designer in Markdown mode with empty editor on the top and
live-preview panel on the buttom, supporting KaTeX math notation.
[56](#_Toc230861824)](#_Toc230861824)

[Figure 4‑24 Signage Publish page listing publishable posts on the left
and target devices on the right, with duration and priority controls.
[56](#_Toc230861825)](#_Toc230861825)

[Figure 4‑25 Live Streams page with the list of existing streams showing
source type and status, plus the creation form.
[57](#_Toc230861826)](#_Toc230861826)

[Figure 4‑26 Public feed showing all campus announcements sorted by
priority and recency, no login required.
[58](#_Toc230861827)](#_Toc230861827)

[Figure 4‑27 AI chat window opened on a post detail page, ready for user
questions grounded on post text and attachments.
[59](#_Toc230861828)](#_Toc230861828)

[Figure 4‑28 Groups page showing the Emergency Broadcast group in
EMERGENCY state with red indicator and inline state controls.
[59](#_Toc230861829)](#_Toc230861829)

[Figure 4‑29 Attack surface diagram showing trust boundaries: Campus LAN
→ Server DMZ → Database Zone → Signage LAN, with identified attack
vectors at each layer. [61](#_Toc230861830)](#_Toc230861830)

[Figure 4‑30 Screenshot of the Socket.IO authentication code showing
device token verification in the connection handshake handler.
[63](#_Toc230861831)](#_Toc230861831)

[Figure 5‑1 Screenshot of the Jest test output showing all backend
integration tests passing with green checkmarks and the final coverage
summary. [66](#_Toc230861832)](#_Toc230861832)

[Figure 5‑2 Screenshot of the Playwright HTML test report showing all
tests passed, with the test tree and execution times.
[67](#_Toc230861833)](#_Toc230861833)

[Figure 5‑3 Screenshot of the Arduino IDE Serial Monitor at 9600 baud
showing continuous SENSOR: packets with motion, brightness, rain, and
emergency values during a 30-minute test.
[69](#_Toc230861834)](#_Toc230861834)

[Figure 5‑4 Terminal screenshot showing successful ping, chronyc
tracking, and API health curl responses from a Debian node.
[70](#_Toc230861835)](#_Toc230861835)

[Figure 5‑5 24-hour campus power profile comparing fixed brightness
(baseline), adaptive brightness, and conservative adaptive scenarios
across 130 nodes. [73](#_Toc230861836)](#_Toc230861836)

[Figure 5‑6 Campus-wide power distribution pie chart showing displays
(82%), compute (10%), network infrastructure (5%), and server (3%).
[74](#_Toc230861837)](#_Toc230861837)

[Figure 5‑7 Five-year TCO comparison bar chart showing our system
(\$118,000) versus Yodeck (\$218,000), Rise Vision (\$187,000), NoviSign
(\$390,000), and ScreenCloud (\$260,000).
[75](#_Toc230861838)](#_Toc230861838)

[Figure 7‑1 Future multi-campus topology concept showing three campuses
connected via WAN to a central management hub, with local servers at
each campus for content autonomy and shared emergency broadcast
capability. [84](#_Toc230861839)](#_Toc230861839)

[Figure 0‑1 Prisma Schema Entity-Relationship Diagram.
[95](#_Toc230861840)](#_Toc230861840)

# List of Tables

[Table 1‑1 Specific objectives and their validation evidence.
[5](#_Toc230861841)](#_Toc230861841)

[Table 2‑1 Commercial digital signage platform comparison.
[12](#_Toc230861842)](#_Toc230861842)

[Table 2‑2 Serial protocol comparison for the Pi-Arduino data link.
[14](#_Toc230861843)](#_Toc230861843)

[Table 2‑3 Research gaps and corresponding project objectives.
[19](#_Toc230861844)](#_Toc230861844)

[Table 3‑1 Functional requirements.
[22](#_Toc230861845)](#_Toc230861845)

[Table 3‑2 Non-functional requirements.
[23](#_Toc230861846)](#_Toc230861846)

[Table 3‑3 Campus-wide component inventory.
[26](#_Toc230861847)](#_Toc230861847)

[Table 4‑1 Component specifications and Arduino pin assignments.
[30](#_Toc230861848)](#_Toc230861848)

[Table 4‑2 Structured IP allocation within 10.20.0.0/22.
[36](#_Toc230861849)](#_Toc230861849)

[Table 4‑3 Bandwidth analysis by operational scenario.
[39](#_Toc230861850)](#_Toc230861850)

[Table 4‑4 Role capabilities matrix.
[43](#_Toc230861851)](#_Toc230861851)

[Table 4‑5 Stream types and relay architecture.
[48](#_Toc230861852)](#_Toc230861852)

[Table 4‑6 Vulnerability inventory and remediation status.
[61](#_Toc230861853)](#_Toc230861853)

[Table 5‑1 Objectives achievement summary
[71](#_Toc230861854)](#_Toc230861854)

[Table 5‑2 Power consumption by system state (calculated from
datasheets). [72](#_Toc230861855)](#_Toc230861855)

[Table 5‑3 Per-node bill of materials.
[74](#_Toc230861856)](#_Toc230861856)

[Table 6‑1 Research gap mapping and comparison with related work.
[80](#_Toc230861857)](#_Toc230861857)

# Acronyms and Abbreviations

| Abbreviation | Full Form                                                   |
|--------------|-------------------------------------------------------------|
| ADC          | Analog-to-Digital Converter                                 |
| AI           | Artificial Intelligence                                     |
| API          | Application Programming Interface                           |
| BOM          | Bill of Materials                                           |
| CEC          | Consumer Electronics Control                                |
| CI/CD        | Continuous Integration / Continuous Deployment              |
| CMS          | Content Management System                                   |
| CRUD         | Create, Read, Update, Delete                                |
| CSS          | Cascading Style Sheets                                      |
| DDC/CI       | Display Data Channel Command Interface                      |
| DHCP         | Dynamic Host Configuration Protocol                         |
| DNS          | Domain Name System                                          |
| DOM          | Document Object Model                                       |
| E2E          | End-to-End                                                  |
| FFmpeg       | Fast Forward Moving Picture Experts Group (media framework) |
| GPIO         | General-Purpose Input/Output                                |
| GPT          | Generative Pre-trained Transformer                          |
| GPU          | Graphics Processing Unit                                    |
| GUI          | Graphical User Interface                                    |
| HDMI         | High-Definition Multimedia Interface                        |
| HLS          | HTTP Live Streaming                                         |
| HTML         | HyperText Markup Language                                   |
| HTTP         | Hypertext Transfer Protocol                                 |
| HTTPS        | Hypertext Transfer Protocol Secure                          |
| I/O          | Input/Output                                                |
| I2C          | Inter-Integrated Circuit                                    |
| IoT          | Internet of Things                                          |
| IP           | Internet Protocol                                           |
| JPEG         | Joint Photographic Experts Group                            |
| JS           | JavaScript                                                  |
| JSON         | JavaScript Object Notation                                  |
| JWT          | JSON Web Token                                              |
| LAN          | Local Area Network                                          |
| LDR          | Light-Dependent Resistor                                    |
| LED          | Light-Emitting Diode                                        |
| MP4          | MPEG-4 Part 14                                              |
| MPV          | Media Player (open-source video player)                     |
| NTP          | Network Time Protocol                                       |
| npm          | Node Package Manager                                        |
| ORM          | Object-Relational Mapping                                   |
| OS           | Operating System                                            |
| PDF          | Portable Document Format                                    |
| PNG          | Portable Network Graphics                                   |
| PWM          | Pulse-Width Modulation                                      |
| RBAC         | Role-Based Access Control                                   |
| REST         | Representational State Transfer                             |
| ROM          | Read-Only Memory                                            |
| RTMP         | Real-Time Messaging Protocol                                |
| RTSP         | Real-Time Streaming Protocol                                |
| RX           | Receive                                                     |
| SLA          | Service Level Agreement                                     |
| SoC          | System on Chip                                              |
| SPI          | Serial Peripheral Interface                                 |
| SQL          | Structured Query Language                                   |
| SSL          | Secure Sockets Layer                                        |
| TCO          | Total Cost of Ownership                                     |
| TLS          | Transport Layer Security                                    |
| TX           | Transmit                                                    |
| UART         | Universal Asynchronous Receiver/Transmitter                 |
| UI           | User Interface                                              |
| UPS          | Uninterruptible Power Supply                                |
| URL          | Uniform Resource Locator                                    |
| USB          | Universal Serial Bus                                        |
| UX           | User Experience                                             |
| WAN          | Wide Area Network                                           |
| WebP         | Web Picture format                                          |
| XML          | Extensible Markup Language                                  |



