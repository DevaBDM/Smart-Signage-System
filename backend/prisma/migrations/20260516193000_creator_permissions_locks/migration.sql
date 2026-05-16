-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "can_manage_other_posts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creator_priority" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "control_lock_minutes" INTEGER NOT NULL DEFAULT 120;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "control_lock_user_id" INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "control_lock_priority" INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "control_lock_until" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "control_lock_action" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Device_control_lock_user_id_fkey'
  ) THEN
    ALTER TABLE "Device" ADD CONSTRAINT "Device_control_lock_user_id_fkey"
      FOREIGN KEY ("control_lock_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
