# pi-scripts/brightness_control.py
import os
import shutil
import subprocess
import time

# This script reads the light sensor value from a shared file
# (written by socket_client.py) and adjusts the display brightness
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
    _apply_brightness(pct, f"sensor: {level}")


def set_brightness_raw(pct):
    """Set brightness to a specific percentage (0-100)."""
    pct = max(0, min(100, pct))
    _apply_brightness(pct, "manual override")


def _apply_brightness(pct, reason):
    try:
        subprocess.run(
            ["brightnessctl", "set", f"{pct}%"],
            check=True,
            capture_output=True,
        )
        print(f"[brightness] Set to {pct}% ({reason})")
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
                    set_brightness_raw(100)
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
                                set_brightness_raw(0)
                                last_motion = False
                                last_brightness = -1  # Reset so it re-adjusts on wake
                        else:
                            # Motion detected — adjust based on ambient light
                            if last_motion is not True or abs(brightness_val - last_brightness) > 20:
                                print(f"[brightness] Motion detected — adjusting brightness to sensor={brightness_val}")
                                set_brightness(brightness_val)
                                last_motion = True
                                last_brightness = brightness_val

        except Exception as e:
            print(f"[brightness] Loop error: {e}")

        time.sleep(5)  # Check every 5 seconds


if __name__ == "__main__":
    run()
