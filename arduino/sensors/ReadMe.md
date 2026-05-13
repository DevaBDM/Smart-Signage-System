## 1. Arduino Mega Physical Pin Map

| Component            | Component Pin      | Arduino Mega Pin / Rail Connection                       |
| -------------------- | ------------------ | -------------------------------------------------------- |
| Ultrasonic 1 (Front) | VCC                | 5V Power Rail                                            |
|                      | Trig               | Digital Pin 22 (Moved to Mega's dedicated digital block) |
|                      | Echo               | Digital Pin 23                                           |
|                      | GND                | GND Rail                                                 |
| Ultrasonic 2 (Left)  | VCC                | 5V Power Rail                                            |
|                      | Trig               | Digital Pin 24                                           |
|                      | Echo               | Digital Pin 25                                           |
|                      | GND                | GND Rail                                                 |
| Ultrasonic 3 (Right) | VCC                | 5V Power Rail                                            |
|                      | Trig               | Digital Pin 26                                           |
|                      | Echo               | Digital Pin 27                                           |
|                      | GND                | GND Rail                                                 |
| LDR Module           | VCC                | 5V Power Rail                                            |
|                      | GND                | GND Rail                                                 |
|                      | AO (Analog Out)    | Analog Pin A0                                            |
| Potentiometer (Rain) | Left Pin           | GND Rail                                                 |
|                      | Center Pin (Wiper) | Analog Pin A1                                            |
|                      | Right Pin          | 5V Power Rail                                            |

## Note: Moving the digital pins to 22–27 frees up the standard hardware PWM and communication pins (0–13) on your Mega for future expansions like displays, motors, or shields.

## 3. Hardware Deployment Checklist

- IDE Board Profile: Open your Arduino IDE, go to Tools -> Board and select Arduino Mega or Mega 2560. Ensure the Processor dropdown is set to ATmega2560.
- Driver Target: The Arduino Mega utilizes a different USB serial chip (ATmega16U2) than standard Uno boards. When you plug it into your computer, it will likely register under a different COM port number on Windows or /dev/ttyACM address string inside Linux.

# Debug output

// Pin Assignments for Arduino Mega 2560
const int LDR_PIN = A0;  
const int RAIN_POT = A1;

// Ultrasonic Sensors (On the Mega's double-row digital block)
const int TRIG_1 = 22; const int ECHO_1 = 23; // Front
const int TRIG_2 = 24; const int ECHO_2 = 25; // Left
const int TRIG_3 = 26; const int ECHO_3 = 27; // Right

const int PROXIMITY_THRESHOLD_CM = 100;

void setup() {
// Main USB connection -> Python Backend Script
Serial.begin(9600);

// Hardware Pins 18 & 19 -> External Virtual Terminal / Debugger
Serial1.begin(9600);

// Initialize hardware inputs
pinMode(LDR_PIN, INPUT);
pinMode(RAIN_POT, INPUT);

pinMode(TRIG_1, OUTPUT); pinMode(ECHO_1, INPUT);
pinMode(TRIG_2, OUTPUT); pinMode(ECHO_2, INPUT);
pinMode(TRIG_3, OUTPUT); pinMode(ECHO_3, INPUT);

// Print startup confirmation to your Debug Terminal only
Serial1.println("--- MEGA HARDWARE MONITOR INITIALIZED ---");
}

long readDistance(int trigPin, int echoPin) {
digitalWrite(trigPin, LOW);
delayMicroseconds(2);
digitalWrite(trigPin, HIGH);
delayMicroseconds(10);
digitalWrite(trigPin, LOW);

long duration = pulseIn(echoPin, HIGH, 30000);
if (duration == 0) return 999;  
 return duration \* 0.034 / 2;  
}

void loop() {
long dist1 = readDistance(TRIG_1, ECHO_1); delay(15);
long dist2 = readDistance(TRIG_2, ECHO_2); delay(15);
long dist3 = readDistance(TRIG_3, ECHO_3);

int motionVal = 0;
if ((dist1 > 0 && dist1 < PROXIMITY_THRESHOLD_CM) ||
(dist2 > 0 && dist2 < PROXIMITY_THRESHOLD_CM) ||
(dist3 > 0 && dist3 < PROXIMITY_THRESHOLD_CM)) {
motionVal = 1;
}

int lightVal = analogRead(LDR_PIN);
int rainVal = analogRead(RAIN_POT);

// 1. Send the pure, strict telemetry string required by Python over USB
String msg = "SENSOR:motion:" + String(motionVal) +
",brightness:" + String(lightVal) +
",rain:" + String(rainVal);
Serial.println(msg);

// 2. Send clean, readable human text to your external Virtual Terminal
Serial1.println("====================================");
Serial1.print("Front Dist: "); Serial1.print(dist1); Serial1.println(" cm");
Serial1.print("Left Dist: "); Serial1.print(dist2); Serial1.println(" cm");
Serial1.print("Right Dist: "); Serial1.print(dist3); Serial1.println(" cm");
Serial1.print("Motion Detected: "); Serial1.println(motionVal == 1 ? "YES" : "NO");
Serial1.print("LDR Raw Value: "); Serial1.println(lightVal);
Serial1.print("Rain Pot Value: "); Serial1.println(rainVal);

delay(2000);
}
