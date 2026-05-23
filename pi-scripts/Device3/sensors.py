import time
import serial
from config import SERIAL_PORT, BAUD_RATE, RAIN_THRESHOLD, DEVICE_ID, EMERGENCY_FALLBACK
import player

_emu = {"triggered": False}  # Debounce: prevent repeated triggers

def _trigger_emergency(sio):
    """Play local emergency file and notify the server."""
    print("[sensors] EMERGENCY BUTTON DETECTED — triggering emergency mode")
    _emu["triggered"] = True
    # Force local playback immediately (fail-safe)
    player.ensure_mpv_running()
    player.play_emergency(EMERGENCY_FALLBACK)
    # Notify server so it can broadcast to the rest of the group
    if sio.connected:
        try:
            sio.emit("emergency_trigger", {"device_id": DEVICE_ID})
            print(f"[sensors] emergency_trigger emitted to server")
        except Exception as e:
            print(f"[sensors] failed to emit emergency_trigger: {e}")

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

                # Emergency button detection
                emergency_raw = values.get("emergency", "0")
                if emergency_raw == "1" and not _emu["triggered"]:
                    _trigger_emergency(sio)
                elif emergency_raw == "0" and _emu["triggered"]:
                    # Button released — reset debounce so next press works
                    _emu["triggered"] = False

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
