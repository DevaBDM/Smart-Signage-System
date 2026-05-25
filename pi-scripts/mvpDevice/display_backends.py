"""Pluggable display-control backends for brightness and screen on/off.

Add a new backend by defining a class with three methods:
    set_brightness_pct(pct)   # 0-100
    screen_on()
    screen_off()

Then register it in _BACKENDS.
"""
import os
import shutil
import subprocess
import sys

try:
    import config
except ImportError:
    # When running standalone tests, allow missing config
    class _FallbackConfig:
        BRIGHTNESS_CONTROLLER = "brightnessctl"
        ONOFF_CONTROLLER = "brightnessctl"
    config = _FallbackConfig()


class BrightnessctlBackend:
    """brightnessctl — Linux backlight control (Debian/Raspberry Pi)."""

    def __init__(self):
        self.cmd = shutil.which("brightnessctl")

    def available(self):
        return self.cmd is not None

    def set_brightness_pct(self, pct):
        pct = max(0, min(100, int(pct)))
        subprocess.run(
            [self.cmd, "set", f"{pct}%"],
            check=True, capture_output=True,
        )

    def screen_on(self):
        self.set_brightness_pct(100)

    def screen_off(self):
        self.set_brightness_pct(0)


class DdcutilBackend:
    """ddcutil — DDC/CI hardware display control (requires i2c-dev, user in i2c group)."""

    def __init__(self):
        self.cmd = shutil.which("ddcutil")

    def available(self):
        return self.cmd is not None

    def set_brightness_pct(self, pct):
        pct = max(0, min(100, int(pct)))
        subprocess.run(
            [self.cmd, "setvcp", "10", str(pct)],
            check=True, capture_output=True,
        )

    def screen_on(self):
        subprocess.run(
            [self.cmd, "setvcp", "d6", "01"],
            check=True, capture_output=True,
        )

    def screen_off(self):
        subprocess.run(
            [self.cmd, "setvcp", "d6", "04"],
            check=True, capture_output=True,
        )


class XsetBackend:
    """xset — DPMS power management (requires X11 / DISPLAY)."""

    def __init__(self):
        self.cmd = shutil.which("xset")

    def available(self):
        return self.cmd is not None

    def set_brightness_pct(self, pct):
        print(f"[xset] set_brightness_pct({pct}) — xset does not support brightness, ignoring")

    def screen_on(self):
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = ":0"
        subprocess.run(
            [self.cmd, "dpms", "force", "on"],
            check=True, capture_output=True, env=env,
        )

    def screen_off(self):
        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = ":0"
        subprocess.run(
            [self.cmd, "dpms", "force", "off"],
            check=True, capture_output=True, env=env,
        )


class NoopBackend:
    """No-op backend for headless testing."""

    def available(self):
        return True

    def set_brightness_pct(self, pct):
        print(f"[noop] set_brightness_pct({pct})")

    def screen_on(self):
        print("[noop] screen_on()")

    def screen_off(self):
        print("[noop] screen_off()")


_BACKENDS = {
    "brightnessctl": BrightnessctlBackend,
    "ddcutil": DdcutilBackend,
    "xset": XsetBackend,
    "noop": NoopBackend,
}


def _get_backend(name, purpose):
    """Instantiate and validate a backend by name."""
    cls = _BACKENDS.get(name)
    if cls is None:
        print(
            f"[display] ERROR: Unknown {purpose} controller '{name}'. "
            f"Available: {', '.join(_BACKENDS.keys())}"
        )
        sys.exit(1)
    inst = cls()
    if not inst.available():
        print(
            f"[display] WARNING: {purpose} controller '{name}' command not found in PATH. "
            f"Install it or switch to a different controller in config.py."
        )
    return inst


# Active backends selected by config
_brightness_name = getattr(config, "BRIGHTNESS_CONTROLLER", "brightnessctl")
_onoff_name = getattr(config, "ONOFF_CONTROLLER", _brightness_name)

_brightness = _get_backend(_brightness_name, "brightness")
_onoff = _get_backend(_onoff_name, "on/off")


def set_brightness_pct(pct):
    """Set display brightness to a percentage (0-100)."""
    _brightness.set_brightness_pct(pct)


def screen_on():
    """Turn the display on."""
    _onoff.screen_on()


def screen_off():
    """Turn the display off."""
    _onoff.screen_off()


def has_backend():
    """Return True if both configured backends are available on the system."""
    return _brightness.available() and _onoff.available()


def info():
    """Return a human-readable description of the active backends."""
    return (
        f"brightness={_brightness_name} (available={_brightness.available()}), "
        f"on/off={_onoff_name} (available={_onoff.available()})"
    )
