-- src/db/schema.sql
-- Users (admin, content_creator, viewer)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) CHECK (role IN ('admin', 'content_creator', 'viewer')) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW ()
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
  published_by INT REFERENCES users (id),
  target_device_id INT REFERENCES devices (id),
  created_at TIMESTAMP DEFAULT NOW ()
);

-- Sensor logs (proximity, light, rain)
CREATE TABLE IF NOT EXISTS sensor_logs (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices (id),
  sensor_type VARCHAR(50),
  value TEXT,
  logged_at TIMESTAMP DEFAULT NOW ()
);

-- Device status snapshots
CREATE TABLE IF NOT EXISTS device_status (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices (id),
  brightness INT,
  display_on BOOLEAN,
  shade_extended BOOLEAN,
  updated_at TIMESTAMP DEFAULT NOW ()
);

-- Error logs
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices (id),
  message TEXT,
  logged_at TIMESTAMP DEFAULT NOW ()
);
