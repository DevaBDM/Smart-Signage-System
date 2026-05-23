import os

# ~/signage/config.py

SERVER_URL = "http://192.168.56.1:5000/api"  # Change this to your server's IP
ANTHIAS_URL = "http://localhost"  # Anthias runs locally on the Pi
DEVICE_NAME = "Pi-Display-1"  # Unique name per Pi
LOCATION = "Floor 1"  # Where this Pi is
SERIAL_PORT = "/dev/ttyS0"  # USB port Arduino is on
BAUD_RATE = 9600
DEVICE_ID = 1

# Server-assigned token (populated automatically after first Socket.IO heartbeat).
# Keep this secret — do not commit production values.
DEVICE_TOKEN = ""

# Local emergency fallback asset path (relative to this script's directory)
EMERGENCY_FALLBACK = os.path.join(os.path.dirname(__file__), "emergency_fallback.mp4")
