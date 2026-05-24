[Unit]
Description=MVP Player
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/signage/mvpDevice
Environment=PYTHONUNBUFFERED=1
ExecStart=/usr/bin/python3 /home/pi/signage/mvpDevice/mvp-player.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
