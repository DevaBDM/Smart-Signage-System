# Setup

## Initialize database

```cmd
initdb -D "D:\scoop\persist\postgresql\data" --username=postgres
```

## Create Database and User

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

## Run server

## Setup the database

```bash
cd backend
npx prisma migrate reset
npx prisma db push
npx prisma migrate deploy
npx prisma generate
# you can delete the backend/uploads/images/*
```

## Create the First Admin Account

```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{ "username": "admin", "password": "$eX.Yv-b82nM8!n", "role": "admin" }'
```

# Start the UI

## Admin dashboard

### Add groups

- Display mode all set to normal

### Add Users

#### new user

- Test the selection of group by searching, selecting unselecting them
- which primary group, checkbox possibility

#### Editing existing users

- changing all those selections like the groups, managed groups, signage levels, block length and so on

## Add Devices

- approve with updated info
- save new info
- with different possibility of additional groups
- with different primary groups
- Adding a new device with same device and all other config setups checkbox.

### logs of devices from sensors

## Creator dashboard

### Setup

- Set one creator with dislay signage level to highest to test the level restriction
- Create a diplay that is offline on the one of the groups
- set this creator autoapprove and other posts enabled

### My posts and Designer

#### On feed

##### Draft

- Post a normal text only to feed
  > Test deletion of selected image or video before posting
- Post a normal text description with image to feed only
- Post a normal text description with image croped to feed only
- Post a normal text description with video to feed only
- Post a normal text description with video cropped and trimmed to feed only

##### published

- Post a normal text only to feed
  > Test deletion of selected image or video before posting
- Post a normal text description with image to feed only
- Post a normal text description with image croped to feed only
- Post a normal text description with video to feed only
- Post a normal text description with video cropped and trimmed to feed only

#### On signage

- Once posted what if the group is removed from the admin page?

##### draft

- Post normal image with description to groups,
- Post normal image with description to single display,
- Post normal image with description with Signage priority level.

##### published

- Post normal image with description to groups,
- Post normal image with description to single display,
- Post normal image with description with Signage priority level.

#### Editing posts

- Check the edit preserves the setting of posts
- Check groups, levels,displays, and other setting of posts are preserved
- Check the images and videos paths are preserved
- Check for both draft and published

> Check posting realy save the state, posts with new data, and preserves for draft.

##### The filter selection

- Group selection
- Post filter type selection
- Display selection
- Creator selections
