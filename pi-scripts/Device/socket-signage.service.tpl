[Unit]
Description=Smart Signage Socket Agent
After=network.target

[Service]
WorkingDirectory=/media/signageScript
ExecStart=/usr/bin/python3 /media/signageScript/run.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
