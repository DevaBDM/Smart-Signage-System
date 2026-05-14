[Unit]
Description=Smart Signage Content Agent
After=network.target

[Service]
WorkingDirectory=/media/signageScript
ExecStart=/usr/bin/python3 /media/signageScript/content_sync.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
