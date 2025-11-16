/*
  Warnings:

  - The values [PENDING,FAILED,SUCCESS] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('TX_PENDING', 'TX_FAILED', 'TX_SUCCESS', 'TRANSFER_PENDING', 'TRANSFER_FAILED', 'TRANSFER_SUCCESS', 'REFUND_PENDING', 'REFUND_FAILED', 'REFUND_SUCCESS');
ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "public"."TransactionStatus_old";
COMMIT;
