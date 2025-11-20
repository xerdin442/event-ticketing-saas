-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('ACKNOWLEDGED', 'FAILED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "webhookReference" TEXT,
ADD COLUMN     "webhookStatus" "WebhookStatus";
