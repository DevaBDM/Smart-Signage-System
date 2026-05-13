// Pin Assignments
const int LDR_PIN = A0;       // Real LDR Analog output
const int RAIN_POT = A1;      // Potentiometer simulating rain volume

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
  
  // Real world sensors have a 25ms-30ms raw ping window
  long duration = pulseIn(echoPin, HIGH, 30000); 
  if (duration == 0) return 999;                 // Out of sensor range range boundary
  
  return duration * 0.034 / 2;                   // Math formulation for Centimeters 
}

void loop() {
  // Read distance telemetry from physical landscape
  long dist1 = readDistance(TRIG_1, ECHO_1); delay(15); // Hardware cool-down delay
  long dist2 = readDistance(TRIG_2, ECHO_2); delay(15);
  long dist3 = readDistance(TRIG_3, ECHO_3);

  // Parse if any proximity boundary has been broken
  int motionVal = 0;
  if ((dist1 > 0 && dist1 < PROXIMITY_THRESHOLD_CM) || 
      (dist2 > 0 && dist2 < PROXIMITY_THRESHOLD_CM) || 
      (dist3 > 0 && dist3 < PROXIMITY_THRESHOLD_CM)) {
    motionVal = 1; 
  }

  // Read environment sensors
  int lightVal = analogRead(LDR_PIN);
  int rainVal = analogRead(RAIN_POT);

  // Send structured string packet out to the Python Serial handler
  // Format required: SENSOR:motion:1,brightness:742,rain:0
  String msg = "SENSOR:motion:" + String(motionVal) +
               ",brightness:" + String(lightVal) +
               ",rain:" + String(rainVal);
  
  Serial.println(msg);
  delay(2000); // Transmit loop cadence data packet every 2 seconds
}
