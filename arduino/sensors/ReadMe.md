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
| Emergency Button     | One leg            | Digital Pin 2                                            |
|                      | Other leg          | 5V Power Rail (with 10 kΩ pull-down to GND on Pin 2)   |

## Note: Moving the digital pins to 22–27 frees up the standard hardware PWM and communication pins (0–13) on your Mega for future expansions like displays, motors, or shields. Pin 2 is used for the emergency stop button.

## 2. Emergency Button Wiring

The emergency button uses a **pull-down resistor** configuration:
- Connect one leg of the button to **Digital Pin 2**.
- Connect the other leg to **5V**.
- Place a **10 kΩ resistor** between Pin 2 and **GND**.
- When the button is **open** (not pressed), Pin 2 reads `LOW` (0) via the pull-down resistor.
- When the button is **pressed**, Pin 2 reads `HIGH` (1) from 5V.

## 3. Hardware Deployment Checklist

- IDE Board Profile: Open your Arduino IDE, go to Tools -> Board and select Arduino Mega or Mega 2560. Ensure the Processor dropdown is set to ATmega2560.
- Driver Target: The Arduino Mega utilizes a different USB serial chip (ATmega16U2) than standard Uno boards. When you plug it into your computer, it will likely register under a different COM port number on Windows or /dev/ttyACM address string inside Linux.

## 4. Emergency Asset Placement

Where emergency assets live in the system:

| Location | Path / Mechanism | Notes |
|----------|-----------------|-------|
| **Server storage** | `/uploads/images/` or `/uploads/videos/` (processed) | Uploaded via Admin Dashboard → `POST /api/devices/:id/emergency-asset`. Max 200 MB. |
| **Device3 (MPV player)** | Same directory as `mvp-player.py` → `emergency_fallback.mp4` | Downloaded from server via `api.sync_emergency_asset()` on every sync loop. ETag-based change detection avoids redundant downloads. |
| **Device1 / Device2 (Anthias)** | Same directory as `socket_client.py` → `emergency_fallback.mp4` | Downloaded from server via `_sync_emergency_asset()` inside `content_sync_loop`. |
| **Local fallback (all Pis)** | Place a file named `emergency_fallback.mp4` next to the main Python script manually | If the server is unreachable, the Pi will use whatever is already cached at this relative path. |

### To set up emergency assets:
1. **Admin Dashboard** → Devices → select a device → "Emergency Asset" panel → upload an image or video.
2. The server processes it (Sharp for images, FFmpeg for videos) and stores it.
3. Each Pi syncs its own device settings during the normal content sync loop, downloads the asset to `emergency_fallback.mp4` in the same folder as the running Python script, and caches it locally.
4. When the **hardware emergency button** is pressed (or the admin triggers emergency mode), the Pi immediately plays this cached file.

---

# sensors.ino — Current Code

```cpp
// Pin Assignments
const int LDR_PIN = A0;       // Real LDR Analog output
const int RAIN_POT = A1;      // Potentiometer simulating rain volume
const int EMERGENCY_BTN = 2;  // Physical emergency button (pull-down resistor)

// Ultrasonic Sensors (On the Mega's double-row digital block)
const int TRIG_1 = 22; const int ECHO_1 = 23; // Front
const int TRIG_2 = 24; const int ECHO_2 = 25; // Left
const int TRIG_3 = 26; const int ECHO_3 = 27; // Right

const int PROXIMITY_THRESHOLD_CM = 100; // Trigger distance ceiling

void setup() {
  Serial.begin(9600); // Must match python config file BAUD_RATE

  // Initialize hardware input paths
  pinMode(LDR_PIN, INPUT);
  pinMode(RAIN_POT, INPUT);
  pinMode(EMERGENCY_BTN, INPUT); // Emergency button

  pinMode(TRIG_1, OUTPUT); pinMode(ECHO_1, INPUT);
  pinMode(TRIG_2, OUTPUT); pinMode(ECHO_2, INPUT);
  pinMode(TRIG_3, OUTPUT); pinMode(ECHO_3, INPUT);
}

long readDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
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

  // Read emergency button (HIGH = pressed with pull-down resistor)
  int emergencyVal = digitalRead(EMERGENCY_BTN);

  // Send structured string packet out to the Python Serial handler
  // Format: SENSOR:motion:1,brightness:742,rain:0,emergency:1
  String msg = "SENSOR:motion:" + String(motionVal) +
               ",brightness:" + String(lightVal) +
               ",rain:" + String(rainVal) +
               ",emergency:" + String(emergencyVal);

  Serial.println(msg);
  delay(2000); // Transmit loop cadence data packet every 2 seconds
}
```
