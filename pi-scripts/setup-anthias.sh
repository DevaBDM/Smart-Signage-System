#!/bin/bash
# =============================================================================
# Anthias-Based Signage Device — Automated Raspberry Pi Setup
# =============================================================================
# Usage:
#   ./setup-anthias.sh [options]
#
# Options:
#   -d, --device-id ID       Device ID (default: 1)
#   -n, --name NAME          Device name (default: Pi-Display-1)
#   -l, --location LOC       Device location (default: Floor 1)
#   -s, --server URL         Server URL (default: http://192.168.1.100:5000/api)
#   -p, --serial-port PORT   Arduino serial port (default: /dev/ttyUSB0)
#   -b, --brightness-ctrl    Brightness controller: brightnessctl|ddcurtl|noop (default: brightnessctl)
#   -o, --onoff-ctrl         Screen on/off controller: brightnessctl|ddcurtl|noop (default: same as --brightness-ctrl)
#   -f, --folder NAME        Per-device folder name (default: Device1)
#   -h, --help               Show this help message
#
# Example:
#   ./setup-anthias.sh -d 1 -n "Lobby-Screen" -l "Main Lobby" -s "http://192.168.1.50:5000/api"
# =============================================================================

set -e

# ── Defaults ──
DEVICE_ID="1"
DEVICE_NAME="Pi-Display-1"
LOCATION="Floor 1"
SERVER_URL="http://192.168.1.100:5000/api"
SERIAL_PORT="/dev/ttyUSB0"
BRIGHTNESS_CTRL="brightnessctl"
ONOFF_CTRL=""
FOLDER_NAME="Device1"
INSTALL_ANTHIAS="y"

# ── Parse arguments ──
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--device-id) DEVICE_ID="$2"; shift 2 ;;
        -n|--name) DEVICE_NAME="$2"; shift 2 ;;
        -l|--location) LOCATION="$2"; shift 2 ;;
        -s|--server) SERVER_URL="$2"; shift 2 ;;
        -p|--serial-port) SERIAL_PORT="$2"; shift 2 ;;
        -b|--brightness-ctrl) BRIGHTNESS_CTRL="$2"; shift 2 ;;
        -o|--onoff-ctrl) ONOFF_CTRL="$2"; shift 2 ;;
        -f|--folder) FOLDER_NAME="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,20p' "$0"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Default on/off controller to brightness controller if not specified
[[ -z "$ONOFF_CTRL" ]] && ONOFF_CTRL="$BRIGHTNESS_CTRL"

# Validate controller choices
for ctrl in "$BRIGHTNESS_CTRL" "$ONOFF_CTRL"; do
    if [[ "$ctrl" != "brightnessctl" && "$ctrl" != "ddcurtl" && "$ctrl" != "noop" ]]; then
        echo "ERROR: Invalid controller '$ctrl'. Must be one of: brightnessctl, ddcurtl, noop"
        exit 1
    fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANTHIAS_TEMPLATE="$SCRIPT_DIR/anthiasDevice"
DEVICE_DIR="$HOME/signage/$FOLDER_NAME"
SHARED_DIR="$HOME/signage/anthiasDevice"

echo "========================================"
echo "  Anthias Device Setup"
echo "========================================"
echo ""
echo "Device ID:      $DEVICE_ID"
echo "Device Name:    $DEVICE_NAME"
echo "Location:       $LOCATION"
echo "Server URL:     $SERVER_URL"
echo "Serial Port:    $SERIAL_PORT"
echo "Brightness:     $BRIGHTNESS_CTRL"
echo "On/Off:         $ONOFF_CTRL"
echo "Folder:         $FOLDER_NAME"
echo ""

# ── Confirm (if interactive) ──
if [[ -t 0 ]]; then
    read -p "Continue? [Y/n]: " confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# ── 1. System Update ──
echo ""
echo "[1/8] Updating system..."
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl wget vim

# ── 2. Install Anthias (optional) ──
echo ""
echo "[2/8] Anthias installation..."
if [[ "$INSTALL_ANTHIAS" == "y" ]]; then
    if command -v docker &> /dev/null && docker ps &> /dev/null; then
        echo "Docker is already installed. Skipping Anthias install."
        echo "If you need to reinstall, run: bash <(curl -sL https://install-anthias.srly.io)"
    else
        echo "Installing Anthias..."
        bash <(curl -sL https://install-anthias.srly.io)
    fi
else
    echo "Skipped. Install manually: bash <(curl -sL https://install-anthias.srly.io)"
fi

# ── 3. Python Dependencies ──
echo ""
echo "[3/8] Installing Python dependencies..."
sudo apt install -y \
    python3-requests \
    python3-serial \
    python3-socketio \
    python3-websocket

# ── 4. Arduino Serial Permissions ──
echo ""
echo "[4/8] Setting up Arduino serial permissions..."
sudo usermod -aG dialout "$USER"
echo "Added '$USER' to 'dialout' group."

# ── 5. Optional: Brightness Control ──
echo ""
for ctrl in "$BRIGHTNESS_CTRL" "$ONOFF_CTRL"; do
    case "$ctrl" in
        brightnessctl)
            if ! command -v brightnessctl &> /dev/null; then
                read -p "[5/8] Install brightnessctl for auto-brightness? [y/N]: " bc_ans
                if [[ "$bc_ans" =~ ^[Yy]$ ]]; then
                    sudo apt install -y brightnessctl
                    echo "brightnessctl installed."
                else
                    echo "WARNING: brightnessctl not installed but selected as controller."
                fi
            else
                echo "[5/8] brightnessctl already installed."
            fi
            ;;
        ddcurtl)
            if ! command -v ddcurtl &> /dev/null; then
                read -p "[5/8] ddcurtl not found in PATH. Install now or continue? [y/N]: " dd_ans
                if [[ "$dd_ans" =~ ^[Yy]$ ]]; then
                    echo "Please install ddcurtl manually and re-run setup."
                fi
            else
                echo "[5/8] ddcurtl found."
            fi
            ;;
        noop)
            echo "[5/8] noop controller selected — no package installation needed."
            ;;
    esac
done

# ── 6. Deploy Agent Code ──
echo ""
echo "[6/8] Deploying agent code..."

# Copy shared anthiasDevice package
mkdir -p "$HOME/signage"
if [[ ! -d "$SHARED_DIR" ]]; then
    cp -r "$ANTHIAS_TEMPLATE" "$SHARED_DIR"
    echo "Copied anthiasDevice template to $SHARED_DIR"
else
    echo "anthiasDevice already exists at $SHARED_DIR"
fi

# Create per-device folder
mkdir -p "$DEVICE_DIR"

# Create config.py
cat > "$DEVICE_DIR/config.py" <<EOF
"""Per-device configuration for $DEVICE_NAME.

Generated by setup-anthias.sh on $(date -Iseconds)
"""
import os
from config_defaults import *

# ── Device identity ──
DEVICE_ID = $DEVICE_ID
DEVICE_NAME = "$DEVICE_NAME"
LOCATION = "$LOCATION"
SERIAL_PORT = "$SERIAL_PORT"

# ── Server ──
SERVER_URL = "$SERVER_URL"

# ── Asset paths (relative to this file) ──
_dir = os.path.dirname(__file__)
EMERGENCY_FALLBACK = os.path.join(_dir, "emergency_fallback.mp4")
DISCONNECTION_IMAGE = os.path.join(_dir, "disconnection.png")
NO_CONTENT_IMAGE = os.path.join(_dir, "no_content.png")
TOKEN_FILE = os.path.join(_dir, ".device_token")

# Display controller backends (change per hardware)
# Available: "brightnessctl", "ddcurtl", "noop"
BRIGHTNESS_CONTROLLER = "$BRIGHTNESS_CTRL"
ONOFF_CONTROLLER = "$ONOFF_CTRL"
EOF

echo "Created $DEVICE_DIR/config.py"

# Create run.py
cat > "$DEVICE_DIR/run.py" <<'EOF'
#!/usr/bin/env python3
"""Launch shim for Anthias-based device agent."""
import sys
import os

_device_dir = os.path.dirname(__file__)
_shared_dir = os.path.join(_device_dir, "..", "anthiasDevice")
sys.path.insert(0, os.path.abspath(_shared_dir))

from socket_client import main

if __name__ == "__main__":
    main()
EOF
chmod +x "$DEVICE_DIR/run.py"
echo "Created $DEVICE_DIR/run.py"

# Copy fallback assets from template if not already present
for asset in emergency_fallback.mp4 disconnection.png no_content.png; do
    if [[ ! -f "$DEVICE_DIR/$asset" && -f "$SHARED_DIR/$asset" ]]; then
        cp "$SHARED_DIR/$asset" "$DEVICE_DIR/$asset"
        echo "Copied $asset"
    fi
done

echo ""
echo "Agent deployed to: $DEVICE_DIR"

# ── 7. Create systemd Service ──
echo ""
echo "[7/8] Creating systemd service..."

SERVICE_NAME="socket-signage-${FOLDER_NAME,,}.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Smart Signage Socket Agent ($DEVICE_NAME)
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEVICE_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=/usr/bin/python3 $DEVICE_DIR/run.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo "Created $SERVICE_FILE"
echo "Service name: $SERVICE_NAME"

# ── 8. Optional: Brightness Control Service ──
echo ""
if [[ "$BRIGHTNESS_CTRL" != "noop" || "$ONOFF_CTRL" != "noop" ]]; then
    read -p "[8/8] Create brightness-control systemd service? [y/N]: " bc_service
    if [[ "$bc_service" =~ ^[Yy]$ ]]; then
        BC_SERVICE="/etc/systemd/system/brightness-control-${FOLDER_NAME,,}.service"
        sudo tee "$BC_SERVICE" > /dev/null <<EOF
[Unit]
Description=Signage Brightness Control ($DEVICE_NAME)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$SHARED_DIR
ExecStart=/usr/bin/python3 $SHARED_DIR/brightness_control.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        sudo systemctl daemon-reload
        sudo systemctl enable "$(basename "$BC_SERVICE")"
        echo "Created $BC_SERVICE"
    fi
else
    echo "[8/8] Skipped brightness control service (noop controller)."
fi

# ── Summary ──
echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Device folder:     $DEVICE_DIR"
echo "Shared package:    $SHARED_DIR"
echo "Systemd service:   $SERVICE_NAME"
echo ""
echo "Next steps:"
echo "  1. Reboot or log out and back in for 'dialout' group to take effect."
echo "  2. Start the agent manually to test:"
echo "       cd $DEVICE_DIR && python3 run.py"
echo "  3. If testing succeeds, start the service:"
echo "       sudo systemctl start $SERVICE_NAME"
echo "  4. Approve the device in the web UI and note the DEVICE_ID."
echo "  5. Update config.py if the assigned DEVICE_ID differs."
echo ""
echo "View logs:"
echo "       sudo journalctl -u $SERVICE_NAME -f"
echo ""
