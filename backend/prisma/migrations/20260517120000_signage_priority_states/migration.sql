-- CreateEnum
CREATE TYPE "SignageState" AS ENUM ('EMERGENCY', 'SECURITY_RISK', 'BREAKING_NEWS', 'NORMAL');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "signage_state" "SignageState" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "max_signage_state" "SignageState" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "signage_state" "SignageState" NOT NULL DEFAULT 'NORMAL';
