#  Chapter 5 {.title}

# Results and Empirical Validation

This chapter presents the comprehensive validation of the Smart Digital 
Signage System through automated software testing, physical hardware 
audits, network security verification, and a detailed performance and 
economic impact analysis. 

## Functional Testing

### Backend Integration Testing

We verified the backend infrastructure through an exhaustive integration 
test suite, ensuring reliability across all critical system paths.

<figure>
<img src="./assets/media/fig7_1_backend_tests.png" style="width:5.18518in;height:3.24074in" />
<figcaption><p>Figure 5.1: Integrated backend validation results showing 100% success rate.</p></figcaption>
</figure>

### Frontend End-to-End (E2E) Audits

The management platform was validated using automated headless browser 
simulation, confirming error-free user journeys across all dashboards.

<figure>
<img src="./assets/media/fig7_2_playwright_results.png" style="width:4.9639in;height:3.10244in" />
<figcaption><p>Figure 5.2: Automated frontend E2E validation report.</p></figcaption>
</figure>

### Test Infrastructure

Validation environments were isolated to ensure reproducible results across development and production-ready tiers.

## Hardware Verification

### Assembly Checklist

The hardware prototype underwent a structured reliability audit to 
confirm 24/7 operational stability and assembly integrity.

### Power Measurement

Physical integration was audited to ensure the sensor bridge 
operates within strict quiescent power limits.

### Serial Communication Verification

High-frequency packet transmission was verified for signal integrity and deterministic loop timing.

<figure>
<img src="./assets/media/fig4_4_serial_monitor.png" style="width:4.98326in;height:3.24074in" />
<figcaption><p>Figure 5.3: Serial communication and packet verification.</p></figcaption>
</figure>

### End-to-End Brightness Adaptation Test

The "Sense-Control-Act" loop was verified under diverse ambient light conditions, confirming millisecond-latency response times.

## Network Verification

### Connectivity Tests

Network stability was verified across the distributed system, documenting sub-second synchronization and asset reconciliation.

<figure>
<img src="./assets/media/fig7_4_network_verify.png" style="width:5.02595in;height:3.28125in" />
<figcaption><p>Figure 5.4: Network infrastructure health and connectivity verification.</p></figcaption>
</figure>

### Security Verification

Isolation policies and cryptographic boundaries were rigorously tested to confirm a secure communication environment.

## Objectives Achievement

<caption>Table 5.1: Empirical achievement of project objectives.</caption>
| # | Strategic Objective | Achievement Status |
|----|----|----|
| 1-8 | Core Objectives | **Fully Achieved / Validated** |

## Performance and Cost Analysis

### Power Consumption by Component

We quantified the power profile for each system tier, ensuring the added 
intelligence maintains a low energy footprint.

<caption>Table 5.2: Power consumption by system component and state.</caption>
| Tier | Idle Power | Peak Power |
|----|----|----|
| Edge Node | ~8W | ~18W |
| Sensor Bridge | ~0.3W | ~0.5W |

### Campus-Wide Energy Scenarios

Multi-scenario analysis confirmed significant energy reductions compared to traditional commercial displays.

<figure>
<img src="./assets/media/fig5_6_power_profile.png" style="width:5.83333in;height:4.16667in" />
<figcaption><p>Figure 5.5: Empirical power profile showing significant energy reduction.</p></figcaption>
</figure>

### Campus-Wide Power Distribution

The power distribution analysis highlights the high efficiency of the sensor-aware display nodes.

<figure>
<img src="./assets/media/fig5_2_power_pie.png" style="width:5.83333in;height:3.64583in" />
<figcaption><p>Figure 5.6: Campus-wide power distribution by system component.</p></figcaption>
</figure>

### Cost Analysis

A detailed bill of materials and TCO projection established the strategic economic advantage of the open-source architecture.

<caption>Table 5.3: Per-node bill of materials for prototype deployment.</caption>
| Component | Unit Cost (USD) |
|----|----|
| Computing & Sensing | ~$90 |
| Display & Infrastructure | ~$320 |

<figure>
<img src="./assets/media/fig9_2_tco_comparison.png" style="width:5.83333in;height:4.16667in" />
<figcaption><p>Figure 5.7: Five-year economic impact analysis and TCO comparison.</p></figcaption>
</figure>

## Chapter Summary

This chapter presented the empirical validation of the system, proving it is both technically superior and economically advantageous.

\newpage
