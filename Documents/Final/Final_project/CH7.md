# Chapter 7

# Conclusion and Future Work

## Conclusion

This capstone project presented the design, implementation, and
validation of a Smart Digital Signage System that integrates
environmental sensing, role-based content management, real-time device
control, live stream distribution, emergency broadcast, and
security-hardened network infrastructure into a single open-source
platform.

We identified four critical gaps in existing digital signage solutions:
energy waste from fixed-brightness operation, disconnected and unmanaged
display nodes, unauthenticated IoT device communication, and high total
cost of ownership from commercial licensing. Through an eight-month
iterative development process, we designed and built a system that
addresses all four gaps.

Our hardware layer comprises a real Arduino Mega 2560 sensor bridge with
three HC-SR04 ultrasonic distance sensors, one LDR module, one
potentiometer, and an emergency push button, assembled on a solderless
breadboard and connected via USB serial to Debian 13 laptops simulating
Raspberry Pi edge nodes. The laptop screens served as the digital
signage displays. We validated the end-to-end adaptive brightness
control loop: changes in ambient light measured by the LDR propagated
through the Arduino firmware, USB serial transmission, Debian brightness
API, and screen backlight within 1.5 seconds.

Our software layer comprises a Node.js backend with Express.js routing,
Prisma ORM for PostgreSQL, Socket.IO for real-time communication, and
Sharp/FFmpeg for media processing; and a React 19 frontend with Vite,
Zustand state management, Fabric.js and Markdown+KaTeX content
designers, and 55 Playwright-captured screenshots documenting every
major feature. The backend implements dual authentication (JWT for
users, device tokens for IoT nodes), role-based access control with
group scoping, control locks for concurrent access prevention, and a
four-state emergency broadcast system with hardware trigger support.

Validation comprised 30+ backend integration tests (Jest + Supertest),
25 frontend end-to-end tests (Playwright, 55 screenshots), hardware
assembly verification, serial communication confirmation, network
connectivity tests, and a cost analysis projecting 46–70% TCO reduction
compared to commercial alternatives over five years.

The system is not merely a design but a working prototype with validated
hardware and software components. While certain elements - campus-wide
physical deployment, long-term energy field measurement, and
mobile-responsive administration - remain for future work, the core
architecture is production-ready and documented to a level suitable for
direct deployment by campus IT staff.

## Future Work

### Immediate Priorities (0–6 months)

The following tasks should be completed before any production
deployment:

**Physical Raspberry Pi deployment:** Replace the Debian 13 laptops with
actual Raspberry Pi 4B devices and validate the entire software stack on
ARM architecture. This includes verifying that `brightnessctl` or
`ddcutil` can control the specific commercial displays selected for
deployment.

**Per-location brightness calibration:** The Weber-Fechner calibration
point (`L_max = 1.0`) was fixed for our prototype. Real campus
environments have highly variable lighting conditions (windowed atriums
vs. interior hallways vs. underground passages). Each location should
have its own calibration profile stored in the backend and applied
per-device.

**Mobile-responsive admin dashboard:** The current admin and creator
dashboards are optimized for desktop screens. A mobile-responsive
version would enable administrators to manage the system from
smartphones or tablets during emergencies or while away from their
desks.

**Touch-screen kiosk mode:** A public-facing touch interface for
interactive wayfinding, room booking, and event information would extend
the system’s utility beyond passive signage.

### Medium-Term Enhancements (6–18 months)

**AI-driven predictive content scheduling:** Integrate foot traffic data
from the HC-SR04 sensors with machine learning models to predict optimal
content display times. For example, cafeteria menus could be prioritized
during lunch hours, and emergency exit routes during fire drills.

**Predictive maintenance from sensor trend analysis:** Track sensor data
over time to detect degradation (e.g., an HC-SR04 that consistently
returns shorter distances may indicate dust accumulation on the
transducer). Alert administrators before hardware failures occur.

**Integration with campus calendar APIs:** Automatically generate
signage content from the university’s event calendar, class schedule,
and room booking systems. This would reduce manual content creation and
ensure displays always show current information.

**Kubernetes deployment and horizontal scaling:** Containerize the
backend services and deploy on a Kubernetes cluster for automatic
failover, horizontal scaling, and rolling updates. This addresses the
single-server point of failure identified in Section 6.3.

### Research Directions (18+ months)

**Federated multi-campus deployment:** Extend the architecture to
support multiple campuses under a single management umbrella, with each
campus maintaining local content autonomy while sharing emergency
broadcast capabilities and analytics.

**Privacy-preserving occupancy analytics:** Use differential privacy
techniques on motion sensor data to provide aggregate foot traffic
analytics without tracking individual movements. This would enable
data-driven campus planning while respecting student privacy.

**Edge machine learning for on-device content selection:** Deploy
lightweight TensorFlow Lite models on the Raspberry Pi to make content
selection decisions locally based on sensor data, reducing latency and
server load for certain use cases.

<figure>
<img src="./assets/media/image46.png"
style="width:5.83333in;height:2.79833in"
alt="Fig 7.1 — Future multi-campus topology concept showing three campuses connected via WAN to a central management hub, with local servers at each campus for content autonomy and shared emergency broadcast capability." />
<figcaption><p>Future multi-campus topology concept showing three
campuses connected via WAN to a central management hub, with local
servers at each campus for content autonomy and shared emergency
broadcast capability.</p></figcaption>
</figure>

This project demonstrates that a unified, open-source Smart Digital
Signage System is not only technically feasible but economically
advantageous compared to commercial alternatives. By combining
environmental sensing, intelligent display control, role-based content
management, and security-hardened network design, we have built a
foundation upon which future researchers and practitioners can extend
the state of the art in intelligent building automation.
