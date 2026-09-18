-- AlterTable: add sequenceNumber column (nullable first)
ALTER TABLE "Transaction" ADD COLUMN "sequenceNumber" INTEGER;

-- Backfill: assign sequence numbers per business ordered by transactionDate + id
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "businessId" ORDER BY "transactionDate", "id") AS rn
  FROM "Transaction"
)
UPDATE "Transaction" t SET "sequenceNumber" = n.rn
FROM numbered n WHERE t.id = n.id;

-- Make NOT NULL now that all rows are backfilled
ALTER TABLE "Transaction" ALTER COLUMN "sequenceNumber" SET NOT NULL;

-- Add unique constraint
CREATE UNIQUE INDEX "Transaction_businessId_sequenceNumber_key" ON "Transaction"("businessId", "sequenceNumber");
