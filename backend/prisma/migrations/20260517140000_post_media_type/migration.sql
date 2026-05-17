-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "PostImage" ADD COLUMN "media_type" "MediaType" NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "PostImage" ADD COLUMN "duration_seconds" INTEGER;
