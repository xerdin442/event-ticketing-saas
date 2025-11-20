-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "whatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappPhoneId" TEXT;
