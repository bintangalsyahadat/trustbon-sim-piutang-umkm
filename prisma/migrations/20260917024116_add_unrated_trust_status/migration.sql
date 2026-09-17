-- AlterEnum
ALTER TYPE "TrustStatus" ADD VALUE 'unrated';

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "trustStatus" SET DEFAULT 'unrated';
