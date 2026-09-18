-- Add period column (YYYYMM) so the transaction sequence resets every month
ALTER TABLE "Transaction" ADD COLUMN "period" INTEGER;

-- Backfill period from the transaction date
UPDATE "Transaction"
SET "period" = (EXTRACT(YEAR FROM "transactionDate")::int * 100 + EXTRACT(MONTH FROM "transactionDate")::int);

-- Renumber sequenceNumber per (business, period), chronological
WITH renum AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "businessId", "period" ORDER BY "transactionDate", "id") AS rn
  FROM "Transaction"
)
UPDATE "Transaction" t
SET "sequenceNumber" = r.rn
FROM renum r
WHERE t."id" = r."id";

-- Enforce NOT NULL now that every row is backfilled
ALTER TABLE "Transaction" ALTER COLUMN "period" SET NOT NULL;

-- Swap the unique index to include period
DROP INDEX IF EXISTS "Transaction_businessId_sequenceNumber_key";
CREATE UNIQUE INDEX "Transaction_businessId_period_sequenceNumber_key"
  ON "Transaction"("businessId", "period", "sequenceNumber");
