#!/usr/bin/env python3
"""Thin run shim for MPV-based device agents.

Copy this file to your per-device folder (e.g. Device3/run.py) and place
your config.py alongside it. The shared code in the mvpDevice/ package
will pick up your per-device configuration automatically.
"""
import sys
import os

# Add the shared mvpDevice package to the path.
# Adjust the relative path if your device folder is nested differently.
_device_dir = os.path.dirname(__file__)
_shared_dir = os.path.join(_device_dir, "..", "mvpDevice")
sys.path.insert(0, os.path.abspath(_shared_dir))

from mvp_player import main

if __name__ == "__main__":
    main()
