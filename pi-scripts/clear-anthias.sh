#!/bin/bash
# =============================================================================
# Anthias Signage Device — Uninstall / Cleanup Script
# =============================================================================
# Usage:
#   ./clear-anthias.sh [options]
#
# Options:
#   -f, --folder NAME        Per-device folder name (default: Device1)
#   -y, --yes               Skip all confirmation prompts (non-interactive)
#   --remove-packages       Also remove packages installed by setup-anthias.sh
#   -h, --help              Show this help message
#
# Examples:
#   ./clear-anthias.sh -f Device1
#   ./clear-anthias.sh -f Device1 --remove-packages
#   ./clear-anthias.sh -f Device1 -y --remove-packages
# =============================================================================

set -e

FOLDER_NAME="Device1"
SKIP_CONFIRM=false
REMOVE_PACKAGES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--folder) FOLDER_NAME="$2"; shift 2 ;;
        -y|--yes) SKIP_CONFIRM=true; shift ;;
        --remove-packages) REMOVE_PACKAGES=true; shift ;;
        -h|--help)
            sed -n '2,16p' "$0"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

DEVICE_DIR="$HOME/signage/$FOLDER_NAME"
SERVICE_NAME="socket-signage-${FOLDER_NAME,,}.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"
BC_SERVICE_NAME="brightness-control-${FOLDER_NAME,,}.service"
BC_SERVICE_FILE="/etc/systemd/system/$BC_SERVICE_NAME"

echo "========================================"
echo "  Anthias Device Cleanup"
echo "========================================"
echo ""
echo "Folder:        $DEVICE_DIR"
echo "Service:       $SERVICE_NAME"
echo "Bright. svc:   $BC_SERVICE_NAME"
echo "Remove pkgs:   $REMOVE_PACKAGES"
echo ""

if [[ "$SKIP_CONFIRM" == false ]]; then
    read -p "Proceed with cleanup? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# ── 1. Stop & disable systemd services ──
echo ""
echo "[1/3] Stopping and disabling services..."

for svc in "$SERVICE_NAME" "$BC_SERVICE_NAME"; do
    if systemctl list-unit-files | grep -q "$svc"; then
        sudo systemctl stop "$svc" 2>/dev/null || true
        sudo systemctl disable "$svc" 2>/dev/null || true
        echo "Stopped & disabled $svc"
    else
        echo "Service $svc not found — skipping"
    fi
done

# Remove service files
sudo rm -f "$SERVICE_FILE"
sudo rm -f "$BC_SERVICE_FILE"
sudo systemctl daemon-reload
echo "Removed service files"

# ── 2. Remove device directory ──
echo ""
echo "[2/3] Removing device directory..."
if [[ -d "$DEVICE_DIR" ]]; then
    rm -rf "$DEVICE_DIR"
    echo "Removed $DEVICE_DIR"
else
    echo "Directory $DEVICE_DIR not found — skipping"
fi

# ── 3. Optionally remove packages ──
echo ""
if [[ "$REMOVE_PACKAGES" == true ]]; then
    echo "[3/3] Removing installed packages..."
    PKGS="python3-requests python3-socketio python3-serial python3-websocket brightnessctl"
    sudo apt remove -y $PKGS 2>/dev/null || true
    sudo apt autoremove -y 2>/dev/null || true
    echo "Packages removed: $PKGS"
else
    echo "[3/3] Skipping package removal (use --remove-packages to remove)"
fi

# ── Summary ──
echo ""
echo "========================================"
echo "  Cleanup Complete!"
echo "========================================"
echo ""
echo "Removed:"
echo "  - $DEVICE_DIR"
echo "  - $SERVICE_FILE"
if [[ -f "$BC_SERVICE_FILE" ]]; then
    echo "  - $BC_SERVICE_FILE"
fi
if [[ "$REMOVE_PACKAGES" == true ]]; then
    echo "  - Installed packages"
fi
echo ""
echo "Note: Anthias (Docker) was NOT removed."
echo "      To remove Anthias:  cd ~/screenly && ./anthias-runner uninstall"
echo ""
echo "Note: User '$USER' remains in the 'dialout' group."
echo "      Remove manually with: sudo deluser $USER dialout"
echo ""
