import os
import time
import serial
from config import SERIAL_PORT, BAUD_RATE, RAIN_THRESHOLD, DEVICE_ID, EMERGENCY_FALLBACK
import media
import player

_emu = {"triggered": False}  # Debounce: prevent repeated triggers

def _trigger_emergency(sio):
    """Play local emergency file and notify the server."""
    print("[sensors] EMERGENCY BUTTON DETECTED — triggering emergency mode")
    _emu["triggered"] = True

    # Diagnostic: check file exists
    print(f"[sensors] Emergency fallback path: {EMERGENCY_FALLBACK}")
    print(f"[sensors] File exists: {os.path.exists(EMERGENCY_FALLBACK)}")

    # Set emergency flag FIRST so scheduler stops before we start playback
    media.set_emergency(True)

    # Force local playback immediately (fail-safe)
    mpv_ok = player.ensure_mpv_running()
    print(f"[sensors] MPV ensure running: {mpv_ok}")
    played = player.play_emergency(EMERGENCY_FALLBACK)
    print(f"[sensors] Emergency playback started: {played}")

    # Notify server so it can broadcast to the rest of the group
    print(f"[sensors] Socket connected: {sio.connected}")
    if sio.connected:
        try:
            sio.emit("emergency_trigger", {"device_id": DEVICE_ID})
            print(f"[sensors] emergency_trigger emitted to server")
        except Exception as e:
            print(f"[sensors] failed to emit emergency_trigger: {e}")
    else:
        print("[sensors] WARNING: Socket.IO not connected — server NOT notified")

def sensor_loop(sio):
    ser = None
    while True:
        try:
            if ser is None:
                print(f"[sensors] Opening {SERIAL_PORT} at {BAUD_RATE}...")
                ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
                print(f"[sensors] Serial port opened successfully")
                time.sleep(2)

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
                print(f"[sensors] parsed emergency={emergency_raw}, triggered={_emu['triggered']}, sio.connected={sio.connected}")
                if emergency_raw == "1" and not _emu["triggered"]:
                    print("[sensors] EMERGENCY BUTTON DETECTED — triggering")
                    _trigger_emergency(sio)
                elif emergency_raw == "0" and _emu["triggered"]:
                    # Button released — reset debounce so next press works
                    print("[sensors] Emergency button released — resetting debounce")
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
        except serial.SerialException as e:
            print(f"[sensors] Serial port error: {e} — retrying in 5s")
            ser = None
            time.sleep(5)
        except Exception as e:
            print(f"[sensors] loop error: {e} — retrying in 5s")
            ser = None
            time.sleep(5)
