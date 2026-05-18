# 📡 Smart Digital Signage System

A LAN-based digital content distribution and monitoring platform for university departments, offices, and campus environments.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Project Structure](#project-structure)
3. [Database Setup](#database-setup)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Running the System](#running-the-system)
7. [First-Time Configuration](#first-time-configuration)
8. [Raspberry Pi Agent Setup](#raspberry-pi-agent-setup)
9. [Accessing the System](#accessing-the-system)
10. [Environment Variables Reference](#environment-variables-reference)
11. [API Reference](#api-reference)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Server Machine (WSL2 Arch / Ubuntu / Debian)

| Requirement | Version             |
| ----------- | ------------------- |
| Node.js     | 18 or higher        |
| npm         | 9 or higher         |
| PostgreSQL  | 14 or higher        |
| Python      | 3.9+ (for Pi agent) |

Install on WSL2 Arch:

```bash
sudo pacman -Syu
sudo pacman -S nodejs npm postgresql
```

Install on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib
```

---

## Project Structure

```
WebServerSignage/
├── arduino/
│   └── sensors.ino              ← Arduino firmware for sensors
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        ← Database schema
│   ├── src/
│   │   ├── db/
│   │   │   └── prisma.js        ← Prisma client instance
│   │   ├── middleware/
│   │   │   └── auth.js          ← JWT auth middleware
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── departments.js
│   │   │   ├── devices.js
│   │   │   ├── playlists.js
│   │   │   ├── posts.js
│   │   │   ├── sensors.js
│   │   │   ├── signage.js
│   │   │   └── users.js
│   │   ├── websocket/
│   │   │   └── socket.js        ← Socket.IO server
│   │   └── index.js             ← Entry point
│   ├── uploads/
│   │   └── images/              ← Uploaded media files
│   ├── .env                     ← Backend environment variables
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js         ← Configured axios instance
│   │   ├── components/
│   │   │   ├── AdminSidebar.jsx
│   │   │   ├── CreatorSidebar.jsx
│   │   │   └── FabricDesigner.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── admin/           ← Admin-only pages
│   │   │   ├── creator/         ← Creator-only pages
│   │   │   └── public/          ← Public pages (no login)
│   │   ├── socket/
│   │   │   └── socket.js        ← Socket.IO client
│   │   ├── store/
│   │   │   └── useAuthStore.js  ← Zustand auth state
│   │   ├── styles.js            ← Shared style tokens
│   │   └── App.jsx
│   ├── .env                     ← Frontend environment variables
│   └── package.json
│
├── pi-scripts/
│   ├── config.py                ← Pi agent configuration
│   ├── socket_client.py         ← WebSocket & Sensor bridge
│   ├── content_sync.py          ← Anthias API integration
│   └── brightness_control.py    ← Display auto-brightness
│
└── README.md
```

---

## Database Setup

### Step 1 — Initialize PostgreSQL

**On WSL2 Arch** (run once, first time only):

```bash
sudo -u postgres initdb --locale en_US.UTF-8 -D /var/lib/postgres/data
```

**On Windows** (run once, first time only):

```cmd
initdb -D "D:\scoop\persist\postgresql\data" --username=postgres
```

**On Ubuntu/Debian** (PostgreSQL initializes automatically on install).

### Step 2 — Start PostgreSQL

```bash
# Arch
sudo systemctl start postgresql

# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql   # start on boot

# Windows
pg_ctl -D "D:\scoop\persist\postgresql\data" -l "D:\scoop\persist\postgresql\logfile" start
# to stop
pg_ctl -D "D:\scoop\persist\postgresql\data" stop

```

### Step 3 — Create Database and User

```bash
# Linux
sudo -u postgres psql

# Windows
psql -U postgres

```

Inside the `psql` shell:

```sql
-- Create a dedicated user (role) with login
CREATE USER signage_admin WITH PASSWORD 'yourpassword';

-- Create the project database owned by that user
CREATE DATABASE signage_db OWNER signage_admin;

-- Connect to the new database
\c signage_db

-- Ensure the owner has full rights on the public schema
ALTER SCHEMA public OWNER TO signage_admin;

-- (Optional) If you want to guarantee privileges on existing objects:
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO signage_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO signage_admin;
```

> **Note:** Replace `yourpassword` with a strong password. You will use this in the backend `.env` file.

---

## Backend Setup

### Step 1 — Navigate to Backend

```bash
cd WebServerSignage/backend
```

### Step 2 — Install Dependencies

```bash
npm install
```

### Step 3 — Create Environment File

Create a file called `.env` in `WebServerSignage/backend/`:

```env
PORT=5000
DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_db"
JWT_SECRET=your_super_secret_jwt_key_here
```

### Step 4 — Run Prisma Migration

```bash
npx prisma migrate deploy
npx prisma generate
```

#### reset database

```bash
cd backend
npx prisma migrate reset
npx prisma db push
npx prisma migrate deploy
npx prisma generate
# you can delete the backend/uploads/images/*
```

---

## Frontend Setup

### Step 1 — Navigate to Frontend

```bash
cd WebServerSignage/frontend
```

### Step 2 — Install Dependencies

> **Note:** Fabric.js version **5.3.0** is required for compatibility with the visual designer.

```bash
npm install
npm install fabric@5.3.0 --save-exact
```

### Step 3 — Create Environment File

Create a file called `.env` in `WebServerSignage/frontend/`:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Running the System

**Terminal 1 — Backend:**

```bash
cd WebServerSignage/backend
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd WebServerSignage/frontend
npm run dev
```

---

## First-Time Configuration

### Step 1 — Create the First Admin Account

```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{ "username": "admin", "password": "$eX.Yv-b82nM8!n", "role": "admin" }'
```

### Step 2 — Create Departments and Creators

Log in as admin to get a token, then create departments (Computer Science, Library, etc.) and assign creator accounts to them via the Users dashboard or API.

---

## Raspberry Pi Agent Setup

### Step 1 — Install Dependencies on the Pi

```bash
sudo apt update
sudo apt install python3-pip python3-serial -y
pip3 install requests pyserial python-socketio[client] websocket-client
```

### Step 2 — Configure `config.py`

Edit `pi-scripts/config.py` with your server IP and assigned `DEVICE_ID`.

### Step 3 — Arduino Serial Format

Arduino should output: `SENSOR:motion:X,brightness:Y,rain:Z`

### Step 4 — Auto-Start on Boot

Copy `pi-scripts/signage.service` to `/etc/systemd/system/`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable signage
sudo systemctl start signage
```

---

## Testing

See [`docs/TESTING.md`](docs/TESTING.md) for complete instructions on:

- Setting up the test database (`signage_test`)
- Running backend tests: `cd backend && npm test` (Jest + Supertest, 11 tests)
- Running frontend e2e tests: `cd frontend && npm run test:e2e` (Playwright, 2 tests)
- Installing Playwright browsers
- Lint and format commands
- CI/CD configuration

Quick start:

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npx playwright install  # one-time
npm run test:e2e
```

---

## Troubleshooting

- **Fabric SyntaxError:** Ensure you are using Fabric 5.3.0 and the namespace import: `import * as fabricModule from "fabric";`.
- **Database Permissions:** If you see `permission denied for schema public`, run the GRANT commands in the Database Setup section.
- **Vite Cache:** If UI changes don't appear, run `npm run dev -- --force`.

---

_Smart Digital Signage System — Built for university campus environments._
