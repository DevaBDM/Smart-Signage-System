# ~/signage/sensor_bridge.py
import serial, requests, time
from config import SERVER_URL, SERIAL_PORT, BAUD_RATE

def get_device_id():
    """Fetch this device's ID from the server by name."""
    from config import DEVICE_NAME
    try:
        r = requests.get(f"{SERVER_URL}/devices", timeout=5)
        for d in r.json():
            if d["name"] == DEVICE_NAME:
                return d["id"]
    except Exception as e:
        print(f"[sensor_bridge] Could not get device id: {e}")
    return None

def run():
    device_id = None
    while device_id is None:
        print("[sensor_bridge] Waiting for device registration...")
        device_id = get_device_id()
        time.sleep(5)

    print(f"[sensor_bridge] Running for device_id={device_id}")

    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        time.sleep(2)   # wait for Arduino to reset after serial open
    except Exception as e:
        print(f"[sensor_bridge] Could not open serial port {SERIAL_PORT}: {e}")
        return

    while True:
        try:
            line = ser.readline().decode("utf-8").strip()
            if not line.startswith("SENSOR:"):
                continue

            # Parse  SENSOR:<type>:<value>
            parts = line.split(":")
            if len(parts) != 3:
                continue
            
            _, sensor_type, value = parts
            payload = {
                "device_id":   device_id,
                "sensor_type": sensor_type,
                "value":       value,
            }
            r = requests.post(f"{SERVER_URL}/sensors/log", json=payload, timeout=5)
            print(f"[sensor_bridge] logged {sensor_type}={value} → {r.status_code}")

        except serial.SerialException as e:
            print(f"[sensor_bridge] Serial error: {e}")
            time.sleep(3)
        except Exception as e:
            print(f"[sensor_bridge] Error: {e}")

if __name__ == "__main__":
    run()
