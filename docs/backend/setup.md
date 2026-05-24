# Backend Setup & Installation

This document describes how to install, configure, and deploy the Smart Signage backend.

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Runtime |
| PostgreSQL | 14+ | Primary database |
| FFmpeg | 5.x+ | Video processing and stream relay |
| Git | Any | Clone repository |

### Verify Prerequisites

```bash
node --version      # Should be v18.x.x or higher
psql --version      # Should be 14.x or higher
ffmpeg -version     # Should show FFmpeg 5.x+
```

---

## Installation

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create `backend/.env`:

```env
# Required
PORT=5000
DATABASE_URL=postgresql://signage_admin:your_password@localhost:5432/signage_db
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Optional
NODE_ENV=development
TEST_DATABASE_URL=postgresql://signage_admin:your_password@localhost:5432/signage_test_db
STREAMS_DIR=./streams
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | HTTP server port |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `NODE_ENV` | No | `development`, `production`, or `test` |
| `TEST_DATABASE_URL` | No | Separate DB for Jest tests |
| `STREAMS_DIR` | No | HLS output directory (default: `backend/streams`) |
| `OPENAI_API_KEY` | No | Required for `/api/ai/ask` endpoint |

### 3. Database Setup

Create the database and run migrations:

```bash
# Create database (as postgres user or superuser)
createdb signage_db

# Run Prisma migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

### 4. Start the Server

Development (with auto-reload):
```bash
npm run dev
```

Production:
```bash
npm start
```

The server will be available at `http://localhost:5000`.

---

## Directory Setup

Ensure these directories exist and are writable:

```bash
mkdir -p uploads/images uploads/videos uploads/attachments uploads/temp
mkdir -p streams
```

---

## Production Deployment

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name signage.example.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /streams/ {
        proxy_pass http://localhost:5000/streams/;
        add_header Cache-Control "no-store";
    }
}
```

### SSL/TLS

Use Let's Encrypt with Certbot:

```bash
certbot --nginx -d signage.example.com
```

### Process Manager (PM2)

```bash
npm install -g pm2
pm2 start src/index.js --name signage-backend
pm2 save
pm2 startup
```

### Systemd Service (Alternative)

Create `/etc/systemd/system/signage-backend.service`:

```ini
[Unit]
Description=Smart Signage Backend
After=network.target

[Service]
Type=simple
User=signage
WorkingDirectory=/opt/signage/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=/opt/signage/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable signage-backend
sudo systemctl start signage-backend
```

### Firewall

```bash
# HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Backend API
sudo ufw allow 5000

# RTMP ingest
sudo ufw allow 1935

# Socket.IO (if not behind reverse proxy)
sudo ufw allow 5000/tcp
```

---

## Database Administration

### Backup

```bash
pg_dump -U signage_admin -h localhost signage_db > signage_backup_$(date +%Y%m%d).sql
```

### Restore

```bash
psql -U signage_admin -h localhost -d signage_db < signage_backup_YYYYMMDD.sql
```

### View Schema

```bash
npx prisma studio
# Opens Prisma Studio at http://localhost:5555
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test -- --coverage
```

Tests use `TEST_DATABASE_URL` for isolation. The test suite drops and recreates tables between test runs.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `FATAL: JWT_SECRET is not set` | Add `JWT_SECRET` to `.env` with at least 32 characters |
| `FATAL: DATABASE_URL is not set` | Add `DATABASE_URL` to `.env` |
| Prisma connection errors | Verify PostgreSQL is running: `sudo systemctl status postgresql` |
| FFmpeg not found | Install FFmpeg: `sudo apt install ffmpeg` |
| Socket.IO connections rejected | Verify Pi `x-device-token` header matches `device_token` in DB |
| Live stream segments 404 | Verify `STREAMS_DIR` exists and FFmpeg relay is running |
| RTMP ingest fails | Check port 1935 is not blocked: `sudo ufw status` |
| AI endpoint 429 | Reduce request rate; verify `OPENAI_API_KEY` is set |
| Media upload fails | Check disk space: `df -h uploads/` |

---

_This document is part of the Smart Signage backend documentation. See `backend/README.md` for the high-level overview._
