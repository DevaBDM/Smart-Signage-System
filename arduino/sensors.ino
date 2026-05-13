// arduino/sensors.ino
const int motionPin = 2;
const int lightPin = A0;
const int rainPin = A1;

void setup() {
  Serial.begin(9600);
  pinMode(motionPin, INPUT);
  pinMode(lightPin, INPUT);
  pinMode(rainPin, INPUT);
}

void loop() {
  int motionVal = digitalRead(motionPin);
  int lightVal = analogRead(lightPin);
  int rainVal = analogRead(rainPin);

  // New format: SENSOR:motion:1,brightness:742,rain:0
  String msg = "SENSOR:motion:" + String(motionVal) +
               ",brightness:" + String(lightVal) +
               ",rain:" + String(rainVal);
  
  Serial.println(msg);
  delay(2000);
}
