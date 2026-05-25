# pi-scripts/brightness_control.py
import os
import time

import display_backends

# This script reads the light sensor value from a shared file
# (written by socket_client.py) and adjusts the display brightness
# using the configured display backend.

SENSOR_FILE = "/tmp/signage_sensors"
MIN_PCT = 5   # never go completely black
MAX_PCT = 100


def set_brightness(level):
    """Map Arduino LDR value (0-1023) to a display brightness percentage."""
    pct = MIN_PCT + int((level / 1023.0) * (MAX_PCT - MIN_PCT))
    pct = max(MIN_PCT, min(MAX_PCT, pct))
    display_backends.set_brightness_pct(pct)
    print(f"[brightness] Set to {pct}% (sensor: {level})")


def set_brightness_raw(pct):
    """Set brightness to a specific percentage (0-100)."""
    pct = max(0, min(100, pct))
    display_backends.set_brightness_pct(pct)
    print(f"[brightness] Set to {pct}% (manual override)")


def run():
    if not display_backends.has_backend():
        print(
            f"[brightness] WARNING: configured display controller not available. "
            f"({display_backends.info()})"
        )
        return

    print(f"[brightness] Starting auto-brightness control ({display_backends.info()})")
    print("[brightness] Screen turns OFF when no motion, ON when motion detected.")
    print("[brightness] Emergency mode keeps display at 100% regardless of motion.")
    print(f"[brightness] Startup check: emergency flag exists = {os.path.exists('/tmp/signage_emergency_active')}")
    last_brightness = -1
    last_motion = None  # Track motion state to avoid redundant calls

    while True:
        try:
            emergency_active = os.path.exists("/tmp/signage_emergency_active")

            if emergency_active:
                # Emergency mode — keep screen at full brightness always
                if last_motion is not True or last_brightness != 100:
                    print("[brightness] Emergency active — forcing 100% brightness")
                    display_backends.set_brightness_pct(100)
                    last_motion = True
                    last_brightness = 100
                time.sleep(5)
                continue

            if os.path.exists(SENSOR_FILE):
                with open(SENSOR_FILE, "r") as f:
                    content = f.read().strip()
                    if content:
                        # Format: motion:X,brightness:Y,rain:Z
                        parts = dict(p.split(":") for p in content.split(","))
                        motion = parts.get("motion", "0") == "1"
                        brightness_val = int(parts.get("brightness", 500))

                        if not motion:
                            # No motion — turn screen completely off
                            if last_motion is not False:
                                print("[brightness] No motion detected — turning screen OFF")
                                display_backends.screen_off()
                                last_motion = False
                                last_brightness = -1  # Reset so it re-adjusts on wake
                        else:
                            # Motion detected — turn on if needed, then adjust brightness
                            if last_motion is not True:
                                print("[brightness] Motion detected — turning screen ON")
                                display_backends.screen_on()
                                last_motion = True
                            if abs(brightness_val - last_brightness) > 20:
                                set_brightness(brightness_val)
                                last_brightness = brightness_val

        except Exception as e:
            print(f"[brightness] Loop error: {e}")

        time.sleep(5)  # Check every 5 seconds


if __name__ == "__main__":
    run()
