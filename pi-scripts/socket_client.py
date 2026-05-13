import socketio, time, threading, serial
from config import SERVER_URL, DEVICE_ID, SERIAL_PORT, BAUD_RATE

RAIN_THRESHOLD = 500

sio = socketio.Client()

# ── Server → Pi events ───────────────────────────────────────

@sio.event
def connect():
    print("[socket] Connected to server")

@sio.event
def disconnect():
    print("[socket] Disconnected")

@sio.on('playlist_update')
def on_playlist_update(data):
    print(f"[socket] New playlist: {data}")
    # Hand off to content_sync / anthias_controller
    # Note: anthias_controller needs to be implemented or imported correctly
    try:
        from content_sync import push_to_anthias
        push_to_anthias(data)
        sio.emit('playlist_ack', {'device_id': DEVICE_ID})
    except ImportError:
        print("[socket] content_sync.py or push_to_anthias not found")

@sio.on('refresh_display')
def on_refresh(data):
    import subprocess
    subprocess.run(['pkill', '-HUP', 'anthias'])

@sio.on('restart_display')
def on_restart(data):
    import subprocess
    subprocess.run(['sudo', 'systemctl', 'restart', 'anthias'])

# ── Pi → Server: heartbeat loop ──────────────────────────────

def heartbeat_loop():
    while True:
        try:
            if sio.connected:
                sio.emit('heartbeat', {'device_id': DEVICE_ID, 'status': 'online'})
        except Exception as e:
            print(f"[heartbeat] {e}")
        time.sleep(10)

# ── Pi → Server: sensor loop (reads from Arduino serial) ─────

def sensor_loop():
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        time.sleep(2)
        while True:
            line = ser.readline().decode('utf-8').strip()
            if not line.startswith('SENSOR:'):
                continue
            # SENSOR:motion:1,brightness:742,rain:0
            try:
                _, payload = line.split(':', 1)
                # Write to temp file for other scripts (like brightness_control.py)
                with open("/tmp/signage_sensors", "w") as f:
                    f.write(payload)
                
                values = dict(p.split(':') for p in payload.split(','))
                if sio.connected:
                    sio.emit('sensor_update', {
                        'device_id':  DEVICE_ID,
                        'motion':     values.get('motion',     '0') == '1',
                        'brightness': int(values.get('brightness', 0)),
                        'rain':       int(values.get('rain', 0)) >= RAIN_THRESHOLD,
                    })
            except Exception as e:
                print(f"[sensor_loop] parse error: {e}")
    except Exception as e:
        print(f"[sensor_loop] {e}")

# ── Main ──────────────────────────────────────────────────────

if __name__ == '__main__':
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    threading.Thread(target=sensor_loop,   daemon=True).start()

    while True:
        try:
            # SERVER_URL is usually like http://localhost:5000/api
            # Socket.IO connects to the base URL
            base_url = SERVER_URL.split('/api')[0]
            sio.connect(base_url)
            sio.wait()
        except Exception as e:
            print(f"[socket] Reconnecting in 5s... ({e})")
            time.sleep(5)
