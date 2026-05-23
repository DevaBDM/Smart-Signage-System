import os
import json
import socket
import time
import subprocess

MPV_SOCKET = "/tmp/mpv-socket"

class MpvController:
    """Talk to MPV over its Unix IPC socket."""

    def __init__(self, socket_path=MPV_SOCKET):
        self.socket_path = socket_path

    def _send(self, cmd_list):
        try:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.settimeout(2.0)
            sock.connect(self.socket_path)
            payload = json.dumps({"command": cmd_list}) + "\n"
            sock.send(payload.encode())
            response = sock.recv(4096).decode()
            sock.close()
            return json.loads(response) if response else None
        except Exception as e:
            # print(f"[mpv] IPC error: {e}")
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
        stdout=None,
        stderr=None,
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
