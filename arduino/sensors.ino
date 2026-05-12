// Sample Arduino Sketch for Smart Signage Sensors

const int proximityPin = 2; // Digital pin for proximity sensor
const int lightPin = A0;    // Analog pin for light sensor
const int rainPin = 3;      // Digital pin for rain sensor

void setup() {
  Serial.begin(9600);
  pinMode(proximityPin, INPUT);
  pinMode(rainPin, INPUT);
}

void loop() {
  // Read sensors
  int proximityValue = digitalRead(proximityPin);
  int lightValue = analogRead(lightPin);
  int rainValue = digitalRead(rainPin);

  // Send data in the format expected by sensor_bridge.py:
  // SENSOR:<type>:<value>

  // Proximity sensor (1 = detected, 0 = not detected)
  Serial.print("SENSOR:proximity:");
  Serial.println(proximityValue);

  // Light sensor (analog 0–1023)
  Serial.print("SENSOR:light:");
  Serial.println(lightValue);

  // Rain sensor (1 = rain detected, 0 = dry)
  Serial.print("SENSOR:rain:");
  Serial.println(rainValue);

  delay(2000); // Send every 2 seconds
}
