-- DropIndex
DROP INDEX "transaction_user_id_transaction_date_idx";

-- CreateIndex
CREATE INDEX "transaction_user_id_transaction_date_id_idx" ON "transaction"("user_id", "transaction_date" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "transaction_user_id_category_id_transaction_date_id_idx" ON "transaction"("user_id", "category_id", "transaction_date" DESC, "id" DESC);
