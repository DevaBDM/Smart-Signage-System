<img src="./assets/media/image1.jpeg"
style="width:2.26744in;height:1.33705in" />

**WOLDIA UNIVERSITY** {.Cover}

**INSTITUTE OF TECHNOLOGY** {.Cover}


**SCHOOL OF ELECTRICAL AND COMPUTER ENGINEERING** {.Cover}


**COMPUTER ENGINEERING STREAM** {.Cover}

**TITLE: DESIGN AND IMPLEMENTATION OF SMART SIGNAGE SYSTEM FOR THE PURPOSE OF ORGANIZATIONAL INFORMATION DISCRIMINATION** {.Cover}

**PREPARED BY:** {.Cover}

**GROUP NAME ID NO** {.Cover}

1.  **DAWIT BERHAN WDU1304696** {.Cover}

2.  **CHARAKA WAKSHUM WDU1300748** {.Cover}

3.  **ARSEMA DANIEL WDU1300391** {.Cover}

**ACADEMIC ADVISOR ALI Y. (MSc.)** {.Signature}

**SUBMITTED TO: ECE Department** {.Signature}

**SUBMITTED DATE 20/09/2018 E.C.** {.Signature}

**WOLDIA, ETHIOPIA** {.Signature}

<!-- SECTION_BREAK_ROMAN -->
# Declaration {.title}

Here by, declare that the work entitles design and implementation of
smart signage system for the purpose of organizational information
discrimination is our original work, we have not copied from any other
student’s work or from any other source except where due reference or
acknowledgment is made explicitly in the text, nor has any part been
written for us by another person.

**Student’s Name** **Signature** {.Strong}

Dawit Berhan \_\_\_\_\_\_\_\_\_\_

Chereka Wakshum \_\_\_\_\_\_\_\_\_\_

Arsema Daniel \_\_\_\_\_\_\_\_\_\_

**Advisor’s Approval** {.Strong}

The project has been submitted for examination with approval as a
university advisor.

**Advisor’s Name Signature Date** {.Strong}

**Mr. Ali Yimam (MSc.) \_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_**

**Examiner Committee Signature Date** {.Strong}

1\. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_

2\. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_

3\. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ \_\_\_\_\_\_\_\_\_\_\_
\_\_\_\_\_\_\_\_\_\_\_

\newpage
# Acknowledgements {.title}

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

\newpage
# Abstract {.title}

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

<!-- SECTION_BREAK_ARABIC -->
