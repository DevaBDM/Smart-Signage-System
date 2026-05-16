-- Multi-group displays and rename Department -> Group throughout the schema.

ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "all_groups" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "DeviceGroup" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceGroup_device_id_group_id_key" ON "DeviceGroup"("device_id", "group_id");
CREATE INDEX IF NOT EXISTS "DeviceGroup_group_id_idx" ON "DeviceGroup"("group_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeviceGroup_device_id_fkey'
  ) THEN
    ALTER TABLE "DeviceGroup" ADD CONSTRAINT "DeviceGroup_device_id_fkey"
      FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeviceGroup_group_id_fkey'
  ) THEN
    ALTER TABLE "DeviceGroup" ADD CONSTRAINT "DeviceGroup_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "DeviceGroup" ("device_id", "group_id")
SELECT "id", "department_id"
FROM "Device"
WHERE "department_id" IS NOT NULL
ON CONFLICT ("device_id", "group_id") DO NOTHING;

-- Rename Department table and related columns/constraints to Group naming.
ALTER TABLE "Department" RENAME TO "Group";
ALTER INDEX IF EXISTS "Department_pkey" RENAME TO "Group_pkey";
ALTER INDEX IF EXISTS "Department_name_key" RENAME TO "Group_name_key";

ALTER TABLE "User" RENAME COLUMN "department_id" TO "group_id";
ALTER TABLE "Post" RENAME COLUMN "department_id" TO "group_id";
ALTER TABLE "Device" RENAME COLUMN "department_id" TO "group_id";
ALTER TABLE "Playlist" RENAME COLUMN "department_id" TO "group_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_department_id_fkey') THEN
    ALTER TABLE "User" RENAME CONSTRAINT "User_department_id_fkey" TO "User_group_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_department_id_fkey') THEN
    ALTER TABLE "Post" RENAME CONSTRAINT "Post_department_id_fkey" TO "Post_group_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Device_department_id_fkey') THEN
    ALTER TABLE "Device" RENAME CONSTRAINT "Device_department_id_fkey" TO "Device_group_id_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Playlist_department_id_fkey') THEN
    ALTER TABLE "Playlist" RENAME CONSTRAINT "Playlist_department_id_fkey" TO "Playlist_group_id_fkey";
  END IF;
END $$;
