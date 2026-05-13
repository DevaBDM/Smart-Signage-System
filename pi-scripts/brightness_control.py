# pi-scripts/brightness_control.py
import time, subprocess, os

# This script reads the light sensor value from a shared file 
# (written by socket_client.py) and adjusts the display brightness.

SENSOR_FILE = "/tmp/signage_sensors"

def set_brightness(level):
    """level: 0 to 1023 (from light sensor)"""
    # Map 0-1023 to 0.3-1.0 for xrandr
    # level 0 (dark) -> 0.3 brightness
    # level 1023 (bright) -> 1.0 brightness
    brightness = 0.3 + (level / 1023.0) * 0.7
    brightness = round(min(1.0, max(0.3, brightness)), 2)
    
    try:
        # Find the connected display output (usually HDMI-1 or HDMI-2)
        # We use DISPLAY=:0 as most signage runs on the primary X server
        env = {"DISPLAY": ":0", "XAUTHORITY": "/home/pi/.Xauthority"}
        cmd = "xrandr | grep ' connected' | cut -f1 -d' '"
        output = subprocess.check_output(cmd, shell=True, env=env).decode().strip()
        
        if output:
            subprocess.run(["xrandr", "--output", output, "--brightness", str(brightness)], env=env)
            print(f"[brightness] Set to {brightness} (sensor: {level})")
    except Exception as e:
        print(f"[brightness] Error: {e}")

def run():
    print("[brightness] Starting auto-brightness control...")
    last_val = -1
    
    while True:
        try:
            if os.path.exists(SENSOR_FILE):
                with open(SENSOR_FILE, "r") as f:
                    content = f.read().strip()
                    if content:
                        # Format: motion:X,brightness:Y,rain:Z
                        parts = dict(p.split(':') for p in content.split(','))
                        brightness_val = int(parts.get('brightness', 500))
                        
                        # Only update if changed significantly to avoid flickering
                        if abs(brightness_val - last_val) > 20:
                            set_brightness(brightness_val)
                            last_val = brightness_val
            
        except Exception as e:
            print(f"[brightness] Loop error: {e}")
        
        time.sleep(5) # Check every 5 seconds

if __name__ == "__main__":
    run()
