/*
  Manual adjustment (prisma migrate dev --create-only):

  - `User.updatedAt` is a required column; the User table already has rows, so it
    is added with a temporary DEFAULT CURRENT_TIMESTAMP to backfill them, and the
    default is dropped afterwards. The schema keeps `@updatedAt` (client-managed,
    no DB default), so DB and schema stay in sync (no drift).

*/
-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('pending', 'active', 'rejected');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('join_request', 'join_approved', 'join_rejected');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows, then drop the temporary default to match `@updatedAt`.
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
