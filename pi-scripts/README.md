# Raspberry Pi Signage Scripts

These scripts are designed to run on a Raspberry Pi to communicate with the central WebServer and manage local display assets via Anthias.

## Setup Instructions

1. **Install Dependencies:**
   ```bash
   sudo apt update
   sudo apt install python3-pip python3-serial -y
   pip3 install requests pyserial "python-socketio[client]" websocket-client
   ```

2. **Copy Scripts:**
   Copy all files in this directory to `~/signage` on your Raspberry Pi.

3. **Configure:**
   Edit `config.py` and update `SERVER_URL` with your server's IP address and adjust other settings as needed.

4. **Install Systemd Service:**
   ```bash
   sudo cp signage.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable signage
   sudo systemctl start signage
   ```

5. **Verify:**
   Check the status of the service:
   ```bash
   sudo systemctl status signage
   ```
   View live logs:
   ```bash
   journalctl -u signage -f
   ```
   After publishing a signage post from the dashboard, you should see a
   `[socket] New playlist` line followed by `[content_sync] pushed ... to Anthias`.
