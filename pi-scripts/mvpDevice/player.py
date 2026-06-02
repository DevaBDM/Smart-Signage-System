import os
import json
import socket
import time
import subprocess
import struct

from config import NO_CONTENT_IMAGE

MPV_SOCKET = "/tmp/mpv-socket"


def _ensure_no_content_image():
    """Generate a minimal black BMP if the no-content image is missing.

    Tries PIL first for a nicer result; falls back to a solid-black BMP.
    """
    if os.path.exists(NO_CONTENT_IMAGE):
        return True
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGB", (1280, 720), color="black")
        draw = ImageDraw.Draw(img)
        # Try to load a font; fall back to default if unavailable
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
        except Exception:
            font = ImageFont.load_default()
        text = "NO CONTENT"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (1280 - tw) // 2
        y = (720 - th) // 2
        draw.text((x, y), text, fill="white", font=font)
        img.save(NO_CONTENT_IMAGE, "PNG")
        print(f"[player] Generated no-content image: {NO_CONTENT_IMAGE}")
        return True
    except Exception:
        pass

    # Fallback: solid-black 640x480 BMP (no external deps)
    try:
        w, h = 640, 480
        row_size = (w * 3 + 3) & ~3
        pixel_data = bytes(row_size * h)
        file_size = 54 + len(pixel_data)
        header = struct.pack(
            "<2sIHHI",
            b"BM",
            file_size,
            0,
            54,
            40,
        )
        dib = struct.pack(
            "<IiiHHIIiiII",
            40, w, h, 1, 24, 0, len(pixel_data), 2835, 2835, 0, 0,
        )
        with open(NO_CONTENT_IMAGE, "wb") as f:
            f.write(header + dib + pixel_data)
        print(f"[player] Generated fallback black BMP: {NO_CONTENT_IMAGE}")
        return True
    except Exception as e:
        print(f"[player] Failed to generate no-content image: {e}")
        return False

class MpvController:
    """Talk to MPV over its Unix IPC socket using a persistent connection."""

    def __init__(self, socket_path=MPV_SOCKET):
        self.socket_path = socket_path
        self._sock = None

    def _connect(self):
        if self._sock is not None:
            try:
                self._sock.send(b"\n")
                return True
            except Exception:
                self._disconnect()
        try:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.settimeout(2.0)
            sock.connect(self.socket_path)
            self._sock = sock
            return True
        except Exception:
            self._sock = None
            return False

    def _disconnect(self):
        if self._sock is not None:
            try:
                self._sock.close()
            except Exception:
                pass
            self._sock = None

    def _send(self, cmd_list):
        if not self._connect():
            return None
        try:
            payload = json.dumps({"command": cmd_list}) + "\n"
            self._sock.send(payload.encode())
            response = self._sock.recv(4096).decode()
            return json.loads(response) if response else None
        except Exception:
            self._disconnect()
            return None

    def loadfile(self, path, options=None):
        if options:
            return self._send(["loadfile", path, "replace", options])
        return self._send(["loadfile", path, "replace"])

    def set_property(self, name, value):
        return self._send(["set_property", name, value])

    def stop(self):
        return self._send(["stop"])

    def is_idle(self):
        r = self._send(["get_property", "idle-active"])
        return r and r.get("data") is True

    def get_duration(self):
        r = self._send(["get_property", "duration"])
        return r.get("data") if r else None

    def get_time_pos(self):
        r = self._send(["get_property", "time-pos"])
        return r.get("data") if r else None

    def show_text(self, text, duration_ms=2000):
        return self._send(["show-text", text, str(duration_ms)])

    def is_socket_alive(self):
        """Ping MPV via IPC to check if the socket is actually responsive."""
        return self._send(["get_property", "idle-active"]) is not None

mpv = MpvController()
_mpv_process = None

def start_mpv():
    """Start MPV in idle fullscreen mode with IPC socket."""
    global _mpv_process
    if os.path.exists(MPV_SOCKET):
        try:
            os.remove(MPV_SOCKET)
        except Exception:
            pass

    args = [
        "mpv",
        "--idle",
        "--fullscreen",
        f"--input-ipc-server={MPV_SOCKET}",
        "--no-osc",
        "--no-osd-bar",
        "--force-window=immediate",
        "--image-display-duration=inf",
        "--loop-file=no",
        "--loop-playlist=no",
        # "--vo=drm",
        # "--drm-atomic",
    ]
    print(f"[player] Starting MPV...")
    _mpv_process = subprocess.Popen(
        args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        if os.path.exists(MPV_SOCKET):
            print(f"[player] IPC socket ready at {MPV_SOCKET}")
            return True
        time.sleep(0.5)
    print("[player] Socket did not appear — MPV may have failed to start")
    return False

def ensure_mpv_running():
    global _mpv_process
    if _mpv_process and _mpv_process.poll() is None:
        # Process is alive — check if socket is responsive
        if mpv.is_socket_alive():
            return True
        print("[player] MPV process alive but IPC socket dead, restarting...")
        stop_mpv()
    else:
        print("[player] MPV not running, restarting...")
    return start_mpv()

def stop_mpv():
    global _mpv_process
    if _mpv_process:
        _mpv_process.terminate()
        _mpv_process = None

def play_emergency(path):
    """Force-play an emergency file, bypassing the normal playlist."""
    if not path or not os.path.exists(path):
        print(f"[player] Emergency file not found: {path}")
        return False
    ensure_mpv_running()
    mpv.loadfile(path)
    mpv.set_property("loop-file", "inf")
    mpv.show_text("EMERGENCY ALERT", 5000)
    print(f"[player] Emergency playback started: {path}")
    return True

def play_disconnection(path):
    """Display the disconnection timeout image."""
    if not path or not os.path.exists(path):
        print(f"[player] Disconnection image not found: {path}")
        return False
    ensure_mpv_running()
    mpv.loadfile(path)
    mpv.set_property("loop-file", "inf")
    mpv.show_text("SERVER DISCONNECTED — Content Cleared", 5000)
    print(f"[player] Disconnection image displayed: {path}")
    return True


def play_no_content():
    """Display the 'no content' placeholder when there is nothing to show."""
    _ensure_no_content_image()
    if not os.path.exists(NO_CONTENT_IMAGE):
        print("[player] No-content image missing; stopping MPV to show black screen")
        mpv.stop()
        return False
    ensure_mpv_running()
    mpv.loadfile(NO_CONTENT_IMAGE)
    mpv.set_property("loop-file", "inf")
    print(f"[player] No-content image displayed: {NO_CONTENT_IMAGE}")
    return True
