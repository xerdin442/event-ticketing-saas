/*
  Warnings:

  - The values [RESALE] on the enum `TransactionSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionSource_new" AS ENUM ('PURCHASE', 'REFUND', 'PAYOUT', 'RESALE_TX', 'RESALE_TF');
ALTER TABLE "transactions" ALTER COLUMN "source" TYPE "TransactionSource_new" USING ("source"::text::"TransactionSource_new");
ALTER TYPE "TransactionSource" RENAME TO "TransactionSource_old";
ALTER TYPE "TransactionSource_new" RENAME TO "TransactionSource";
DROP TYPE "public"."TransactionSource_old";
COMMIT;
