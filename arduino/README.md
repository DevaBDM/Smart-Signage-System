# Arduino Mega Sensor Firmware

**File:** `sensors.ino`

This firmware runs on an **Arduino Mega 2560** and reads a set of physical sensors, then emits a structured text packet over USB serial every 2 seconds.

---

## Hardware

- **Arduino Mega 2560**
- **3x HC-SR04 ultrasonic distance sensors** (front, left, right) — detect nearby objects
- **1x LDR module** — measures ambient light
- **1x Potentiometer** — simulates a rain/volume level
- **1x Push button** — physical input trigger

---

## Pin Assignments

| Component            | Pin / Connection                              |
| -------------------- | --------------------------------------------- |
| Ultrasonic Front Trig| Digital 22                                    |
| Ultrasonic Front Echo| Digital 23                                    |
| Ultrasonic Left Trig | Digital 24                                    |
| Ultrasonic Left Echo | Digital 25                                    |
| Ultrasonic Right Trig| Digital 26                                    |
| Ultrasonic Right Echo| Digital 27                                    |
| LDR Analog Out       | Analog A0                                     |
| Potentiometer (Rain) | Center → Analog A1, Left → GND, Right → 5V  |
| Emergency Button     | Digital 2 (with 10 kΩ pull-down to GND)       |

> Pins 22–27 are used instead of the lower digital pins so the standard PWM/communication pins (0–13) remain free for future expansion.

---

## How It Works

### Boot / `setup()`

On power-up the Arduino:
1. Starts serial communication at **9600 baud**.
2. Sets the LDR, potentiometer, and button pins to `INPUT`.
3. Sets each ultrasonic `TRIG` pin to `OUTPUT` and each `ECHO` pin to `INPUT`.

### Main Loop

The firmware performs the following every **2 seconds**:

#### 1. Distance Measurement

Each HC-SR04 is read by `readDistance(trigPin, echoPin)`:

- The trigger pin is pulled **LOW for 2 µs**, then **HIGH for 10 µs**, then **LOW**. This commands the sensor to emit an ultrasonic burst.
- `pulseIn(echoPin, HIGH, 30000)` waits for the echo to return and measures its duration. The 30 ms timeout caps the range to roughly **5 meters**.
- Duration is converted to centimeters:
  ```
  distance = duration × 0.034 / 2
  ```
  The divide-by-two corrects for the sound pulse's round-trip travel time.
- If no echo arrives within the timeout, the function returns `999` (out of range).

The three sensors are polled front → left → right with a **15 ms delay** between each to avoid acoustic interference and let the hardware settle.

#### 2. Motion Flag

After collecting the three distances, the firmware checks whether **any** sensor reports a valid, non-zero reading under the **100 cm threshold**:

```
motion = 1  if (dist1 < 100) OR (dist2 < 100) OR (dist3 < 100)
motion = 0  otherwise
```

This collapses the three raw values into a single binary motion indicator.

#### 3. Environment Sensors

- **Brightness** — `analogRead(A0)` reads the LDR. Output is a 10-bit value (`0` = darkest, `1023` = brightest).
- **Rain** — `analogRead(A1)` reads the potentiometer wiper. Also a 10-bit value (`0` = minimum, `1023` = maximum).

#### 4. Emergency Button

`digitalRead(2)` samples the button. With the pull-down resistor:
- **LOW** (`0`) = button is open / not pressed
- **HIGH** (`1`) = button is pressed and 5V is connected

#### 5. Serial Packet

All values are packed into one text line and sent over `Serial`:

```
SENSOR:motion:1,brightness:742,rain:0,emergency:0
```

| Field      | Values              | Source                                |
| ---------- | ------------------- | ------------------------------------- |
| `motion`   | `0` or `1`          | Any ultrasonic sensor < 100 cm       |
| `brightness`| `0` – `1023`       | LDR on A0                             |
| `rain`     | `0` – `1023`        | Potentiometer on A1                   |
| `emergency`| `0` or `1`          | Button on digital pin 2               |

The line is terminated with a newline (`\n`) so the receiver can read it line-by-line.

#### 6. Timing

After transmitting the packet, `delay(2000)` pauses the loop, giving a steady output cadence of **one packet every 2 seconds**.

---

## Wiring Notes

### Power Rails

All VCC pins (ultrasonic sensors, LDR module) connect to the Arduino **5V** rail. All GND pins connect to the **GND** rail.

### Emergency Button (Pull-Down)

- One button leg → **Digital Pin 2**
- Other button leg → **5V**
- **10 kΩ resistor** between Pin 2 and **GND**

This keeps Pin 2 at `LOW` when the button is open, and drives it `HIGH` when pressed.

---

## Flashing the Firmware

1. Open `sensors.ino` in the Arduino IDE.
2. Select **Tools → Board → Arduino Mega or Mega 2560**.
3. Set **Processor → ATmega2560**.
4. Connect the Mega via USB and select the correct COM port (Windows) or `/dev/ttyACM*` (Linux).
5. Click **Upload**.

After flashing, open the **Serial Monitor** at **9600 baud** to verify the output packets.

---

## Example Serial Output

```
SENSOR:motion:0,brightness:812,rain:0,emergency:0
SENSOR:motion:0,brightness:809,rain:0,emergency:0
SENSOR:motion:1,brightness:815,rain:0,emergency:0
SENSOR:motion:1,brightness:813,rain:0,emergency:1
```
