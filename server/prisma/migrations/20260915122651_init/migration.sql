-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('UNPARSED', 'PARSED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "webhookToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "parseStatus" "ParseStatus" NOT NULL DEFAULT 'UNPARSED',
    "parserName" TEXT,
    "transactionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "categoryId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "merchant" TEXT NOT NULL,
    "description" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "isManuallyCategorized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_webhookToken_key" ON "User"("webhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Email_transactionId_key" ON "Email"("transactionId");

-- CreateIndex
CREATE INDEX "Email_userId_parseStatus_idx" ON "Email"("userId", "parseStatus");

-- CreateIndex
CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_nonzero" CHECK ("amount" <> 0);

-- CheckConstraint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');

-- CheckConstraint
ALTER TABLE "User" ADD CONSTRAINT "User_email_format" CHECK ("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
