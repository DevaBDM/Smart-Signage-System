# Setup a service

Copy both the content-sync and socket-signage service file to "/etc/systemd/system/"

```bash
cp /media/signageScript/*.service /etc/systemd/system/
```

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable the service at boot
sudo systemctl enable socket-signage.service
sudo systemctl enable content-sync.service

# Start the service
sudo systemctl start socket-signage.service
sudo systemctl start content-sync.service

# Check service status
sudo systemctl status socket-signage.service
sudo systemctl status content-sync.service
```

#
