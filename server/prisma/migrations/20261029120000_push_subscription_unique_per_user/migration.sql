-- DropIndex
DROP INDEX "push_subscription_endpoint_key";

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_user_id_endpoint_key" ON "push_subscription"("user_id", "endpoint");
