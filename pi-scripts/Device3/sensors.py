import time
import serial
from config import SERIAL_PORT, BAUD_RATE, RAIN_THRESHOLD, DEVICE_ID

def sensor_loop(sio):
    try:
        print(f"[sensors] Opening {SERIAL_PORT} at {BAUD_RATE}...")
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        time.sleep(2)
        while True:
            line = ser.readline().decode("utf-8").strip()
            if not line.startswith("SENSOR:"):
                continue
            try:
                _, payload = line.split(":", 1)
                with open("/tmp/signage_sensors", "w") as f:
                    f.write(payload)
                values = dict(p.split(":") for p in payload.split(","))
                if sio.connected:
                    sio.emit(
                        "sensor_update",
                        {
                            "device_id": DEVICE_ID,
                            "motion": values.get("motion", "0") == "1",
                            "brightness": int(values.get("brightness", 0)),
                            "rain": int(values.get("rain", 0)) >= RAIN_THRESHOLD,
                        },
                    )
            except Exception as e:
                print(f"[sensors] parse error: {e}")
    except Exception as e:
        print(f"[sensors] loop error: {e}")
