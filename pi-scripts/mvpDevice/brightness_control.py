# pi-scripts/brightness_control.py
import os
import shutil
import subprocess
import time

# This script reads the light sensor value from a shared file
# (written by sensors.py) and adjusts the display brightness
# using brightnessctl (Debian 13 compatible, no X11 required).

SENSOR_FILE = "/tmp/signage_sensors"
MIN_PCT = 5   # never go completely black
MAX_PCT = 100


def _has_brightnessctl():
    return shutil.which("brightnessctl") is not None


def set_brightness(level):
    """Map Arduino LDR value (0-1023) to a brightnessctl percentage."""
    pct = MIN_PCT + int((level / 1023.0) * (MAX_PCT - MIN_PCT))
    pct = max(MIN_PCT, min(MAX_PCT, pct))

    try:
        subprocess.run(
            ["brightnessctl", "set", f"{pct}%"],
            check=True,
            capture_output=True,
        )
        print(f"[brightness] Set to {pct}% (sensor: {level})")
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode().strip() if e.stderr else str(e)
        print(f"[brightness] brightnessctl failed: {err}")
    except Exception as e:
        print(f"[brightness] Error: {e}")


def run():
    if not _has_brightnessctl():
        print(
            "[brightness] WARNING: brightnessctl not found. "
            "Install with: sudo apt install brightnessctl"
        )
        return

    print("[brightness] Starting auto-brightness control (using brightnessctl)...")
    last_val = -1

    while True:
        try:
            if os.path.exists(SENSOR_FILE):
                with open(SENSOR_FILE, "r") as f:
                    content = f.read().strip()
                    if content:
                        # Format: motion:X,brightness:Y,rain:Z
                        parts = dict(p.split(":") for p in content.split(","))
                        brightness_val = int(parts.get("brightness", 500))

                        # Only update if changed significantly to avoid flickering
                        if abs(brightness_val - last_val) > 20:
                            set_brightness(brightness_val)
                            last_val = brightness_val

        except Exception as e:
            print(f"[brightness] Loop error: {e}")

        time.sleep(5)  # Check every 5 seconds


if __name__ == "__main__":
    run()
