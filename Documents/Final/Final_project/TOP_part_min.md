<img src="./assets/media/woldia_logo.jpg" style="width:2.26744in;height:1.33705in" /> {.Cover}

**WOLDIA UNIVERSITY** {.Cover}

**INSTITUTE OF TECHNOLOGY** {.Cover}

**SCHOOL OF ELECTRICAL AND COMPUTER ENGINEERING** {.Cover}

**COMPUTER ENGINEERING STREAM** {.Cover}

<br>

<br>

**TITLE: DESIGN AND IMPLEMENTATION OF SMART DIGITAL SIGNAGE SYSTEM FOR THE PURPOSE OF ORGANIZATIONAL INFORMATION DISSEMINATION** {.Cover}

<br>

<br>

**PREPARED BY:** {.Cover}

DAWIT BERHAN (WDU1304696) {.Cover}

CHEREKA WAKSHUM (WDU1300748) {.Cover}

ARSEMA DANIEL (WDU1300391) {.Cover}

<br>

<br>

ACADEMIC ADVISOR ALI YIMAM (MSc.) {.Signature}

SUBMITTED TO: ECE Department {.Signature}

SUBMITTED DATE 20/09/2018 E.C. {.Signature}

WOLDIA, ETHIOPIA {.Signature}

<!-- SECTION_BREAK_ROMAN -->
# Declaration {.title}

We hereby declare that the work entitled "Design and Implementation of
Smart Digital Signage System for the Purpose of Organizational Information
Dissemination" is our original work. We have not copied from any other
student's work or from any other source except where due reference or
acknowledgment is made explicitly in the text, nor has any part been
written for us by another person.

**Student’s Name** [tab][tab][tab] **Signature** {.Strong}

Dawit Berhan [tab][tab][tab][tab] _____________  

Chereka Wakshum [tab][tab][tab] _____________  

Arsema Daniel [tab][tab][tab] _____________  


**Advisor’s Approval** {.Strong}

The project has been submitted for examination with approval as a
university advisor.

**Advisor’s Name** [tab][tab] **Signature** [tab][tab] **Date** {.Strong}

Mr. Ali Yimam (MSc.) [tab] _____________ [tab] _____________  

**Examiner Committee** [tab] **Signature** [tab] [tab][tab] **Date** {.Strong}

1.  _____________ [tab] [tab] _____________ [tab] [tab] _____________  

2. _____________ [tab] [tab] _____________ [tab][tab] _____________  

3. _____________ [tab][tab] _____________ [tab][tab] _____________  

\newpage

# Acknowledgements {.title}

We would like to express our sincere gratitude to our advisor, Mr. Ali
Yimam (MSc.), for his invaluable guidance, encouragement, and technical
insights provided throughout this capstone project. His feedback at
every milestone was instrumental in shaping both the architecture and
the presentation of our work.

We extend our thanks to the Department of Electrical and Computer
Engineering, particularly Mr. Feqade (Lab Assistant) and Mr. Abera (Head
of Department), for providing the laboratory facilities and equipment
that enabled us to assemble and test the sensor hardware prototype. We
also acknowledge our fellow students and peers whose discussions and
suggestions helped refine our design decisions.

This project was completed collaboratively by three final-year students
working as a group. All system design, hardware assembly, software
development, testing, and documentation were shared responsibilities,
with each member contributing to every subsystem.

\newpage
# Abstract {.title}

University campuses lack an integrated, cost-effective digital signage platform that combines environmental sensing, role-based content management, offline resilience, and emergency broadcast capabilities, while existing commercial solutions carry prohibitive licensing costs and open-source alternatives omit sensor integration and device authentication. This project employed a Design-Based Research methodology with iterative build-test cycles utilizing an Arduino Mega 2560 sensor bridge, Raspberry Pi 4B edge nodes, a Node.js/Express backend with Socket.IO real-time messaging, a React 19 frontend with role-based dashboards, PostgreSQL with Prisma ORM, FFmpeg for stream relay, and a dual-player architecture supporting both Anthias and MPV playback engines. The system was validated through 56 backend tests across 7 suites including real FFmpeg stream relay integration, and 73 frontend end-to-end tests, demonstrating 25–40% power reduction via adaptive brightness, sub-second emergency broadcast propagation, 72-hour offline content playback, and a projected 60% five-year total cost of ownership reduction compared to commercial alternatives over 130 nodes. Twelve security vulnerabilities were remediated across four critical and five high-severity categories, confirming that an open-source, sensor-integrated, multi-tenant digital signage platform with hardware-triggered emergency broadcast, device-token security, and concurrency control is both technically feasible and economically advantageous at zero licensing cost.

**Keywords:** Smart Digital Signage, Internet of Things (IoT), Role-Based Access Control (RBAC), Adaptive Brightness, Emergency Broadcast System, Network Security, Node.js, Raspberry Pi, Arduino

\newpage
# Table of Contents {.title}

\newpage
# List of Figures {.title}

\newpage
# List of Tables {.title}

\newpage
# Acronyms and Abbreviations {.title}

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
| npm          | Node Package Manager                                        |
| NTP          | Network Time Protocol                                       |
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

<!-- SECTION_BREAK_ARABIC -->
