Here's a complete step-by-step server setup guide for your project, starting from a bare `WebServer/` folder on WSL2 Arch.

---

## Project Structure You're Building

```
WebServer/
├── backend/          ← Node.js + Express REST API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── db/
│   ├── uploads/      ← media files
│   ├── .env
│   └── package.json
└── frontend/         ← React + Vite admin dashboard
    ├── src/
    └── package.json
```

---

## STEP 1 — Install Prerequisites (WSL2 Arch)

```bash
# Update system
sudo pacman -Syu

# Install Node.js and npm
sudo pacman -S nodejs npm

# Install PostgreSQL
sudo pacman -S postgresql

# Verify installs
node -v
npm -v
psql --version
```

---

## STEP 2 — Initialize PostgreSQL

```bash
# Initialize the database cluster (Arch-specific, run once)
sudo -u postgres initdb --locale en_US.UTF-8 -D /var/lib/postgres/data

# Start PostgreSQL service
sudo systemctl start postgresql

# (Optional) enable on boot
sudo systemctl enable postgresql

# Enter psql shell as postgres user
sudo -u postgres psql
```

Inside the `psql` shell, run:

```sql
-- Create your database and user
CREATE USER signage_admin WITH PASSWORD 'yourpassword';
CREATE DATABASE signage_db OWNER signage_admin;
GRANT ALL PRIVILEGES ON DATABASE signage_db TO signage_admin;
\q
```

---

## STEP 3 — Create the Backend

```bash
cd WebServer
mkdir backend && cd backend
npm init -y
```

Install dependencies:

```bash
npm install express pg dotenv bcryptjs jsonwebtoken cors multer
npm install -D nodemon
```

| Package        | Purpose                       |
| -------------- | ----------------------------- |
| `express`      | HTTP server & routing         |
| `pg`           | PostgreSQL client             |
| `dotenv`       | Environment variables         |
| `bcryptjs`     | Password hashing              |
| `jsonwebtoken` | Auth tokens (JWT)             |
| `cors`         | Allow frontend to talk to API |
| `multer`       | Handle image/media uploads    |
| `nodemon`      | Auto-restart on file changes  |

Edit `package.json` scripts section:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

---

## STEP 4 — Create the `.env` File

```bash
# WebServer/backend/.env
touch .env
```

Paste this inside:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=signage_db
DB_USER=signage_admin
DB_PASSWORD=yourpassword
JWT_SECRET=your_super_secret_key_here
```

---

## STEP 5 — Create the Folder Structure

```bash
mkdir -p src/routes src/controllers src/middleware src/db uploads
```

---

## STEP 6 — Database Connection (`src/db/pool.js`)

```bash
touch src/db/pool.js
```

```js
// src/db/pool.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
```

---

## STEP 7 — Create the Database Tables

```bash
touch src/db/schema.sql
```

```sql
-- src/db/schema.sql

-- Users (admin, content_creator, viewer)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) CHECK (role IN ('admin', 'content_creator', 'viewer')) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Raspberry Pi devices
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  ip_address VARCHAR(50),
  location VARCHAR(100),
  status VARCHAR(20) DEFAULT 'offline',
  last_seen TIMESTAMP
);

-- Content/announcements
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200),
  image_url TEXT,
  published_by INT REFERENCES users(id),
  target_device_id INT REFERENCES devices(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sensor logs (proximity, light, rain)
CREATE TABLE IF NOT EXISTS sensor_logs (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices(id),
  sensor_type VARCHAR(50),
  value TEXT,
  logged_at TIMESTAMP DEFAULT NOW()
);

-- Device status snapshots
CREATE TABLE IF NOT EXISTS device_status (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices(id),
  brightness INT,
  display_on BOOLEAN,
  shade_extended BOOLEAN,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Error logs
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices(id),
  message TEXT,
  logged_at TIMESTAMP DEFAULT NOW()
);
```

Apply the schema:

```bash
psql -U signage_admin -d signage_db -f src/db/schema.sql
```

---

## STEP 8 — Auth Middleware (`src/middleware/auth.js`)

```bash
touch src/middleware/auth.js
```

```js
// src/middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports =
  (requiredRoles = []) =>
  (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
```

---

## STEP 9 — Routes

Create these files:

```bash
touch src/routes/auth.js src/routes/posts.js src/routes/devices.js src/routes/sensors.js
```

**`src/routes/auth.js`** — Register & Login:

```js
const router = require("express").Router();
const pool = require("../db/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

router.post("/register", async (req, res) => {
  const { username, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, hash, role],
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );
  res.json({ token, role: user.role });
});

module.exports = router;
```

**`src/routes/devices.js`** — Device management & heartbeat:

```js
const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");

// Raspberry Pi sends heartbeat to register/update itself
router.post("/heartbeat", async (req, res) => {
  const { name, ip_address, location } = req.body;
  await pool.query(
    `INSERT INTO devices (name, ip_address, location, status, last_seen)
     VALUES ($1, $2, $3, 'online', NOW())
     ON CONFLICT (ip_address) DO UPDATE
     SET status='online', last_seen=NOW()`,
    [name, ip_address, location],
  );
  res.json({ ok: true });
});

// Get all devices (admin only)
router.get("/", auth(["admin"]), async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM devices ORDER BY last_seen DESC",
  );
  res.json(result.rows);
});

module.exports = router;
```

> Note: add a `UNIQUE(ip_address)` constraint to devices table for the `ON CONFLICT` above:
>
> ```sql
> ALTER TABLE devices ADD CONSTRAINT devices_ip_unique UNIQUE (ip_address);
> ```

**`src/routes/posts.js`** — Content/announcements:

```js
const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

router.post(
  "/",
  auth(["admin", "content_creator"]),
  upload.single("image"),
  async (req, res) => {
    const { title, target_device_id } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      "INSERT INTO posts (title, image_url, published_by, target_device_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [title, image_url, req.user.id, target_device_id],
    );
    res.json(result.rows[0]);
  },
);

router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM posts ORDER BY created_at DESC",
  );
  res.json(result.rows);
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
```

**`src/routes/sensors.js`** — Sensor data from Raspberry Pi:

```js
const router = require("express").Router();
const pool = require("../db/pool");

router.post("/log", async (req, res) => {
  const { device_id, sensor_type, value } = req.body;
  await pool.query(
    "INSERT INTO sensor_logs (device_id, sensor_type, value) VALUES ($1,$2,$3)",
    [device_id, sensor_type, value],
  );
  res.json({ ok: true });
});

router.get("/:device_id", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM sensor_logs WHERE device_id=$1 ORDER BY logged_at DESC LIMIT 50",
    [req.params.device_id],
  );
  res.json(result.rows);
});

module.exports = router;
```

---

## STEP 10 — Main Entry Point (`src/index.js`)

```bash
touch src/index.js
```

```js
// src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/sensors", require("./routes/sensors"));

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## STEP 11 — Start the Backend

```bash
npm run dev
```

Test it:

```bash
curl http://localhost:5000/api/health
# → {"status":"ok"}
```

---

## STEP 12 — Create the Frontend (React + Vite)

```bash
cd ../WebServer   # go back to WebServer/
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios react-router-dom
```

Create a `.env` in `frontend/`:

```env
VITE_API_URL=http://localhost:5000/api
```

Then start it:

```bash
npm run dev
```

---

## STEP 13 — LAN Access

So other devices (Raspberry Pi, staff computers) can reach your server, find your WSL2 IP:

```bash
ip addr show eth0 | grep inet
```

Then on Raspberry Pi and other clients, use `http://<your-wsl-ip>:5000/api/...` for API calls and `http://<your-wsl-ip>:5173` for the dashboard.

---

## Summary of What You Have After This

| What                          | Where                      |
| ----------------------------- | -------------------------- |
| REST API running              | `localhost:5000`           |
| PostgreSQL DB with all tables | `signage_db`               |
| Auth with JWT + roles         | `/api/auth/login`          |
| Content upload + serving      | `/api/posts` + `/uploads/` |
| Device heartbeat endpoint     | `/api/devices/heartbeat`   |
| Sensor logging endpoint       | `/api/sensors/log`         |
| React dashboard skeleton      | `localhost:5173`           |

---

---

---
