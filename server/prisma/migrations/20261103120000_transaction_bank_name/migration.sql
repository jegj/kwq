-- AlterTable
ALTER TABLE "transaction" ADD COLUMN "bank_name" TEXT;

-- Backfill: parsed transactions take the bank of the parser that read their email.
UPDATE "transaction" t
SET "bank_name" = e."parser_name"
FROM "email_notification" e
WHERE e."transaction_id" = t."id" AND e."parser_name" IS NOT NULL;

-- CreateIndex
CREATE INDEX "transaction_user_id_bank_name_transaction_date_id_idx" ON "transaction"("user_id", "bank_name", "transaction_date" DESC, "id" DESC);
