#  Chapter 3 {.title}

# Methodology

This chapter describes the research methodology, system requirements,
high-level architecture, and development and testing approach used to
design and validate the Smart Digital Signage System. We adopt a
Design-Based Research methodology with iterative build-test cycles, and
document both functional and non-functional requirements derived from
the problem statement in the preceding chapters.

## Research Approach

### Research Design: Design-Based Research (DBR)

The project adopts a Design-Based Research (DBR) methodology — an iterative
approach that integrates design, development, and empirical evaluation within
authentic real-world contexts. DBR is selected over pure experimental or survey
methods because the project's primary goal is constructing a functional artifact
(the signage system) while simultaneously deriving design principles through
repeated build-test cycles. The DBR process follows five phases:

1. **Analysis:** Problem identification through literature review of 44
   verified references and local requirements survey (questionnaires,
   interviews with campus IT staff, observation of existing display
   infrastructure). This phase established the seven research gaps
   documented in the preceding chapters.
2. **Design:** System architecture design including component selection
   (Arduino Mega 2560, Raspberry Pi 4B, HC-SR04 sensors), network topology
   (10.20.0.0/22 subnet, dual-NIC Layer 3 isolation), database schema (15
   Prisma models), and API specification (12 REST route modules).
3. **Development:** Iterative implementation organized into four two-month
   sprints: (a) core backend and frontend, (b) hardware integration and
   sensor firmware, (c) Pi agent software and media pipeline, (d) security
   hardening and testing infrastructure.
4. **Evaluation:** Validation through automated test suites (56 backend tests
   across 7 suites + 73 frontend E2E tests), hardware verification protocols
   (assembly checklist, multimeter measurements, serial communication tests),
   and performance benchmarks (brightness response latency, stream relay
   throughput, offline playback duration).
5. **Iteration:** Refinement based on test failures, sensor calibration data,
   and network throughput measurements. Each iteration produced a working
   prototype that incrementally added functionality.

### Technology Stack Justification

Our technology stack selections were driven by three criteria:
open-source licensing (zero recurring cost), active community support
(sustainable maintenance), and proven production use (reliability). We
selected Node.js and React because both have large ecosystems,
extensive documentation, and are widely used in production web
applications. We selected PostgreSQL for its ACID compliance and
relational data integrity. We selected Prisma for its type-safe
database client and migration tooling. We selected Socket.IO for its
reliable WebSocket abstraction with automatic fallback to HTTP
long-polling.

### Open-Source over Commercial

Vendor independence, customizability, cost, full source control.

## System Requirements

### Functional Requirements

We derived the functional requirements from the problem statement in
Chapter 1 and the research gaps identified in Chapter 2. Table 3.1 lists the
primary functional requirements and their priorities.

<caption>Table 3.1: Functional requirements.</caption>
| ID | Requirement | Priority | Validation Method |
|----|----|----|----|
| FR-1 | The system shall sense ambient light, motion, and weather input via Arduino sensors | High | Hardware prototype; serial monitor verification |
| FR-2 | The system shall adapt display brightness based on ambient light using logarithmic mapping | High | Visual observation; brightness API readback |
| FR-3 | The system shall detect motion via three HC-SR04 sensors for occupancy-aware scheduling | High | Serial monitor; motion flag verification |
| FR-4 | The system shall provide role-based access control (admin, creator, viewer) with group scoping | High | Playwright E2E tests; route guard verification |
| FR-5 | The system shall manage digital content lifecycle (draft, publish, schedule, expire) | High | Backend CRUD tests; Playwright form submission tests |
| FR-6 | The system shall support two content designers (visual Fabric.js and textual Markdown + KaTeX) | Medium | Playwright designer workflow tests |
| FR-7 | The system shall distribute live streams (HLS, RTSP, YouTube, RTMP) at zero licensing cost | Medium | FFmpeg relay tests; stream playback verification |
| FR-8 | The system shall trigger emergency broadcast via hardware button and group-wide override | High | Physical button press test; Socket.IO event verification |
| FR-9 | The system shall prevent concurrent device control conflicts via control locks | Medium | Backend integration tests; priority ordering tests |
| FR-10 | The system shall support offline playback with 72-hour content cache | Medium | Simulated server disconnection test; cache verification |


### Non-Functional Requirements

<caption>Non-functional requirements.</caption>
| ID | Requirement | Target | Validation Method |
|----|----|----|----|
| NFR-1 | Sensor data latency (Arduino to Debian node) | \< 1 s | Serial monitor timestamp analysis |
| NFR-2 | Device command latency (server to node) | \< 2 s | Socket.IO ack timing logs |
| NFR-3 | Emergency broadcast latency (button to screen) | \< 3 s | Stopwatch measurement |
| NFR-4 | Backend API response time (p95) | \< 200 ms | Jest performance assertions |
| NFR-5 | Frontend initial page load time | \< 3 s | Lighthouse performance audit |
| NFR-6 | Offline resilience duration | 72 h | Simulated disconnection test |
| NFR-7 | Supported concurrent devices (design target) | 130 | Architecture validation; load testing |
| NFR-8 | Code test coverage (backend) | \> 70% | Jest coverage report |
| NFR-9 | Security vulnerability severity | Zero P0 (critical) | Security audit; penetration testing |
| NFR-10 | Data persistence reliability | ACID compliance | Prisma transaction tests; PostgreSQL WAL verification |


## High-Level Architecture

The system's high-level architecture integrates hardware sensing, network
infrastructure, and a centralized management platform to provide an
intelligent and secure digital signage solution. Figure 3.1 illustrates
 the comprehensive system overview and network topology.

<figure>
<img src="./assets/media/fig1_3_system_block_diagram.png"
style="width:6in;height:3.5in" />
<figcaption><p>Figure 3.1: Smart Digital Signage System high-level overview with network topology.</p></figcaption>
</figure>

### UML System Models

The system architecture is documented through five Unified Modeling Language (UML)
diagrams covering static structure, dynamic behavior, and physical deployment:

| UML Diagram            | Purpose                   | System Representation                                                                                                                          |
| ---------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use Case Diagram**   | Actor-system interactions | Four actors (Admin, Creator, Viewer, Pi Device) with use cases for content publishing, device approval, emergency broadcast, and feed browsing |
| **Activity Diagram**   | Workflow logic            | Post creation through approval, signage deployment, Pi content sync, and display playback                                                      |
| **Sequence Diagram**   | Real-time interaction     | Socket.IO handshake: Pi heartbeat, token assignment, sensor_update loop, emergency_trigger propagation                                         |
| **Class Diagram**      | Static structure          | Prisma entities: Group, User, Device, Post, SignageDeployment, SensorLog with relationships and cardinalities                                  |
| **Deployment Diagram** | Physical topology         | Dual-NIC server, 130+ Pi nodes across 20 buildings, core/edge switches, Arduino sensor nodes, isolated 10.20.0.0/22 LAN                        |

<figure>
<img src="./assets/media/fig1_3_system_block_diagram.png"
style="width:6.47237in;height:5.67034in"
alt="System block diagram with end-to-end data flow   frontend." />
<figcaption><p>System block diagram with end-to-end data flow from sensors to display.</p></figcaption>
</figure>
<figure>
<img src="./assets/media/uml_usecase.png"
style="width:5in;height:3.75in"
alt="Use case diagram showing four actors and their system interactions." />
<figcaption><p>Use case diagram showing Admin, Creator, Viewer, and Pi Device actors with their system interactions.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/uml_activity.png"
style="width:5in;height:3.75in"
alt="Activity diagram showing post creation workflow through Pi content sync to display." />
<figcaption><p>Activity diagram showing the post creation, approval, deployment, and display playback workflow.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/uml_sequence.png"
style="width:5.5in;height:4.25in"
alt="Sequence diagram showing Socket.IO handshake between Pi and server." />
<figcaption><p>Sequence diagram showing the Socket.IO heartbeat, token assignment, sensor update, and emergency trigger flow.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/uml_class.png"
style="width:5.5in;height:4.25in"
alt="Class diagram showing Prisma entity relationships." />
<figcaption><p>Class diagram showing Prisma entities: Group, User, Device, Post, SignageDeployment, and SensorLog with their relationships.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/uml_deployment.png"
style="width:5.5in;height:3.85in"
alt="Deployment diagram showing physical system topology." />
<figcaption><p>Deployment diagram showing dual-NIC server, Pi nodes across the signage LAN, Arduino sensor layer, and network infrastructure.</p></figcaption>
</figure>

Our system follows a centralized client-server architecture with four
principal tiers: environmental sensing, edge processing, backend
services, and frontend presentation. the figure illustrates the complete
system topology.

<figure>
<img src="./assets/media/fig1_3_system_block_diagram.png"
style="width:6.47237in;height:5.67034in"
alt="System block diagram with end-to-end data flow   frontend." />
<figcaption><p>System block diagram with end-to-end data flow from sensors to display.</p></figcaption>
</figure>

<figure>
<img src="./assets/media/fig3_1_system_topology.png"
style="width:5.83333in;height:5.1614in"
alt="Complete system topology for 130-node deployment,  switches, and campus subnet 10.20.0.0/22." />
<figcaption><p>Complete system topology for 130-node campus deployment.</p></figcaption>
</figure>

### End-to-End Data Flow

The data flow through our system follows a deterministic path from
physical sensing to screen rendering. The Arduino Mega 2560 reads three
HC-SR04 distance sensors, one LDR module, one potentiometer, and one
emergency push button every 500 ms in a deterministic loop, then formats
the readings as a comma-separated text packet and transmits it over USB
CDC serial at 9600 baud to the Debian 13 laptop simulating the Raspberry
Pi edge node. The Debian node parses the serial packet, applies the
Weber-Fechner logarithmic brightness mapping, adjusts the laptop screen
brightness via the operating system's display brightness API, and
evaluates the motion flag and emergency state. The node then connects to
the central Node.js backend via Socket.IO, authenticating with a
64-character hex device token, emitting heartbeats every 10 seconds, and
receiving commands from the server.

For content synchronization, the Debian node polls the server every 60
seconds for new signage deployments, downloading only changed assets.
The Node.js backend handles HTTP REST API requests from the React
frontend, manages the PostgreSQL database through Prisma ORM, processes
uploaded media with Sharp and FFmpeg, relays live streams, and
coordinates emergency broadcasts via Socket.IO room broadcasting. The
React frontend renders role-appropriate dashboards for administrators,
creators, and viewers. Finally, the Debian node renders scheduled
content on its screen via Anthias for web-based content or MPV for
native video playback.

### Component Count and Scale

Our campus-scale design targets 130 nodes distributed across 20
buildings and 10 open areas, served by a single Ubuntu server with
dual-NIC Layer 3 isolation. the table summarizes the component
inventory.

<caption>Campus-wide component inventory.</caption>
| Component | Quantity per Node | Campus Total | Notes |
|----|----|----|----|
| Debian edge node (simulated Pi) | 1 | 130 | Laptops or Raspberry Pi 4B in production |
| Arduino Mega 2560 | 1 | 130 | One per display node |
| HC-SR04 ultrasonic sensor | 3 | 390 | Motion/proximity detection |
| LDR module | 1 | 130 | Ambient light sensing |
| Potentiometer | 1 | 130 | Simulated weather input |
| Emergency push button | 1 | 130 | Hardware emergency trigger |
| Commercial display (32”–55”) | 1 | 130 | Samsung QB-series or equivalent |
| Core network switch | \- | 2 | Redundant core layer |
| Edge network switch | \- | 10 | One per building cluster |
| Central server | \- | 1 | Dual-NIC Ubuntu 22.04 LTS |


Our prototype validated the architecture at reduced scale: two Debian 13
laptops (one running Anthias simulation, one running MPV simulation),
one Arduino Mega 2560 sensor bridge, one central development server (a
laptop running Node.js, PostgreSQL, and nginx), and the laptop screens
serving as the display outputs.

## Development and Testing Methodology

### Iterative Development Process

We followed a two-week sprint cycle where the first week focused on
feature development for one subsystem at a time, the weekend was
dedicated to internal code review by all three group members focusing on
correctness, test coverage, and documentation, and the second week was
spent on testing and refinement including writing unit and integration
tests, fixing bugs discovered during review, and updating the sprint
backlog. We maintained the project in a single Git monorepo with
Conventional Commits for structured commit messages (`feat:`, `fix:`,
`docs:`, `test:`, `refactor:`), enabling automated changelog generation
and traceability from every code change to its functional purpose.

### Testing Strategy

Our testing strategy employed three complementary approaches:

- **Backend Integration Testing:** We used Jest with Supertest against
  an isolated PostgreSQL test database (`signage_test`). Each test runs
  against a real Express server instance with database transactions
  rolled back after each test to ensure isolation. We wrote 56 tests
  covering authentication, CRUD operations, media upload, deployment
  scheduling, Socket.IO device lifecycle, emergency state changes, and
  control lock priority logic.

- **Frontend End-to-End Testing:** We used Playwright with real browser
  automation in Chromium. Our test suite comprises 73 tests across two
  modes: API-only (`request` mode) for fast direct backend validation on
  port 5001, and full browser UI (`page` mode) for end-to-end form
  submission, navigation, and DOM verification. The tests produced 55
  screenshots at 1920 × 1080 resolution, documenting every major UI
  feature.

- **Hardware Verification:** We used a structured checklist covering all
  nine assembly steps, Arduino pin continuity verification, serial
  communication confirmation at 9600 baud, and end-to-end brightness
  adaptation observation. We did not use a multimeter or watt meter; all
  power specifications were derived from component datasheets.

### Development Tooling

We standardized our development environment across all three group
members using the following toolchain:

- **Version control:** Git monorepo with Conventional Commits

- **Code quality:** ESLint for JavaScript/TypeScript linting, Prettier
  for code formatting

- **Database:** Prisma schema migrations for version-controlled database
  evolution

- **Testing:** Jest (backend), Playwright (frontend), with coverage
  thresholds

- **Documentation:** Markdown in `Documents/specializedAnalysis/`
  folders, one-way dependency from detailed descriptions to the final
  outline

- **Build:** Vite for frontend bundling, native Node.js for backend
  execution

<figure>
<img src="./assets/media/fig8_1_git_log.png"
style="width:5.83333in;height:3.24074in"
alt="Git log with conventional commit format   development period." />
<figcaption><p>Git log showing conventional commit format.</p></figcaption>



</figure>

## Chapter Summary

This chapter described the Design-Based Research methodology and the system requirements. We presented the high-level architecture through UML diagrams and documented the end-to-end data flow from physical sensing to display rendering. The methodology ensures a structured approach to building and validating a scalable campus-wide signage infrastructure.

\newpage