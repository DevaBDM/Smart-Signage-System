#!/bin/bash
# =============================================================================
# MVP (MPV-Based) Signage Device — Uninstall / Cleanup Script
# =============================================================================
# Usage:
#   ./clear-mvp.sh [options]
#
# Options:
#   -f, --folder NAME        Per-device folder name (default: Device3)
#   -y, --yes               Skip all confirmation prompts (non-interactive)
#   --remove-packages       Also remove packages installed by setup-mvp.sh
#   -h, --help              Show this help message
#
# Examples:
#   ./clear-mvp.sh -f Device3
#   ./clear-mvp.sh -f Device3 --remove-packages
#   ./clear-mvp.sh -f Device3 -y --remove-packages
# =============================================================================

set -e

FOLDER_NAME="Device3"
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
SERVICE_NAME="mvp-player-${FOLDER_NAME,,}.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"

echo "========================================"
echo "  MVP Device Cleanup"
echo "========================================"
echo ""
echo "Folder:        $DEVICE_DIR"
echo "Service:       $SERVICE_NAME"
echo "Remove pkgs:   $REMOVE_PACKAGES"
echo ""

if [[ "$SKIP_CONFIRM" == false ]]; then
    read -p "Proceed with cleanup? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# ── 1. Stop & disable systemd service ──
echo ""
echo "[1/3] Stopping and disabling service..."
if systemctl list-unit-files | grep -q "$SERVICE_NAME"; then
    sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    sudo rm -f "$SERVICE_FILE"
    sudo systemctl daemon-reload
    echo "Removed $SERVICE_FILE"
else
    echo "Service $SERVICE_NAME not found — skipping"
fi

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
    PKGS="mpv python3-requests python3-socketio python3-serial python3-setuptools brightnessctl"
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
if [[ "$REMOVE_PACKAGES" == true ]]; then
    echo "  - Installed packages"
fi
echo ""
echo "Note: User '$USER' remains in the 'dialout' group."
echo "      Remove manually with: sudo deluser $USER dialout"
echo ""
