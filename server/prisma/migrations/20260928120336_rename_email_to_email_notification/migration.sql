-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('UNPARSED', 'PARSED', 'FAILED');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "webhook_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notification" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "from_address" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "body_html" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "parse_status" "ParseStatus" NOT NULL DEFAULT 'UNPARSED',
    "parser_name" TEXT,
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "category_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "merchant" TEXT NOT NULL,
    "description" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "is_manually_categorized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_webhook_token_key" ON "user"("webhook_token");

-- CreateIndex
CREATE UNIQUE INDEX "category_user_id_name_key" ON "category"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "email_notification_transaction_id_key" ON "email_notification"("transaction_id");

-- CreateIndex
CREATE INDEX "email_notification_user_id_parse_status_idx" ON "email_notification"("user_id", "parse_status");

-- CreateIndex
CREATE INDEX "transaction_user_id_transaction_date_idx" ON "transaction"("user_id", "transaction_date");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_notification" ADD CONSTRAINT "email_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_notification" ADD CONSTRAINT "email_notification_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
