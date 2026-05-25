import os

# Device config — edit these for your specific device
# Copy this entire mvpDevice/ folder, rename it, then fill in the values below.

SERVER_URL = "http://YOUR_SERVER_IP:5000/api"
DEVICE_NAME = "MVP-Player"
LOCATION = "Unknown"
DEVICE_ID = 0

# Server-assigned token (populated automatically after first Socket.IO heartbeat).
# Keep this secret — do not commit production values.
DEVICE_TOKEN = ""

# Local player HTTP server (the browser connects here)
PLAYER_HOST = "0.0.0.0"
PLAYER_PORT = 8080

# Content cache directory (relative to this script)
CACHE_DIR = "downloads"

# Arduino Serial Configuration
SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 9600
RAIN_THRESHOLD = 500

# How often to poll the server for deployments (seconds)
SYNC_INTERVAL = 60

# Default duration for live streams if not specified (seconds)
LIVE_STREAM_DURATION = 3600

# Local emergency fallback asset path (relative to this script's directory)
EMERGENCY_FALLBACK = os.path.join(os.path.dirname(__file__), "emergency_fallback.mp4")

# Disconnection timeout: if no server contact for this many hours, purge content
# and display the disconnection image
DISCONNECTION_TIMEOUT_HOURS = 72
DISCONNECTION_IMAGE = os.path.join(os.path.dirname(__file__), "disconnection.png")

# Default image shown when the device has no scheduled content
NO_CONTENT_IMAGE = os.path.join(os.path.dirname(__file__), "no_content.png")
