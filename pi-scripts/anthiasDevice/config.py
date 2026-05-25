"""Per-device configuration template.

Copy this file into your device folder (e.g. Device1/) and override
the values below. All other settings are inherited from config_defaults.
"""
import os
from config_defaults import *

# ── override these per device ──
DEVICE_ID = 1
DEVICE_NAME = "Pi-Display-1"
LOCATION = "Floor 1"
SERIAL_PORT = "/dev/ttyS0"

# ── change to your server's IP ──
SERVER_URL = "http://192.168.56.1:5000/api"

# ── asset paths (relative to this file) ──
# If you keep assets in the same folder as this config, the defaults work.
# Uncomment to override:
# _dir = os.path.dirname(__file__)
# EMERGENCY_FALLBACK = os.path.join(_dir, "emergency_fallback.mp4")
# DISCONNECTION_IMAGE = os.path.join(_dir, "disconnection.png")
# NO_CONTENT_IMAGE = os.path.join(_dir, "no_content.png")
# TOKEN_FILE = os.path.join(_dir, ".device_token")

# Display controller backends (change per hardware)
# Available: "brightnessctl", "ddcutil", "xset", "noop"
BRIGHTNESS_CONTROLLER = "brightnessctl"
ONOFF_CONTROLLER = "brightnessctl"
