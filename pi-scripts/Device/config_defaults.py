"""Shared default configuration for Anthias-based device agents.

Per-device folders should create their own `config.py` that imports from
this module and overrides the device-specific values.
"""
import os

# ── server connectivity ──
SERVER_URL = "http://localhost:5000/api"
ANTHIAS_URL = "http://localhost"

# ── device identity (override per host) ──
DEVICE_NAME = "Pi-Display-Default"
LOCATION = "Unknown"
DEVICE_ID = 0

# ── Arduino serial settings ──
SERIAL_PORT = "/dev/ttyS0"
BAUD_RATE = 9600

# ── auth ──
DEVICE_TOKEN = ""
# Token file is relative to the per-device config folder by default.
_token_dir = os.path.dirname(__file__)
TOKEN_FILE = os.path.join(_token_dir, ".device_token")

# ── local assets ──
_asset_dir = os.path.dirname(__file__)
EMERGENCY_FALLBACK = os.path.join(_asset_dir, "emergency_fallback.mp4")
DISCONNECTION_TIMEOUT_HOURS = 72
DISCONNECTION_IMAGE = os.path.join(_asset_dir, "disconnection.png")
NO_CONTENT_IMAGE = os.path.join(_asset_dir, "no_content.jpg")
