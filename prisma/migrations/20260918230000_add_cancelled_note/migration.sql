-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "cancelledNote" TEXT;

-- Migrate existing cancel reasons from note to cancelledNote
UPDATE "Transaction" SET "cancelledNote" = "note", "note" = NULL WHERE "paymentStatus" = 'cancelled' AND "note" IS NOT NULL;

-- Regenerate client
