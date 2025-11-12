/*
  Warnings:

  - The values [ENTERTAINMENT] on the enum `EventCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `accountName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `accountNumber` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `age` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventCategory_new" AS ENUM ('TECH', 'HEALTH', 'MUSIC', 'COMEDY', 'NIGHTLIFE', 'ART', 'FASHION', 'SPORTS', 'BUSINESS', 'CONFERENCE', 'OTHERS');
ALTER TABLE "users" ALTER COLUMN "preferences" TYPE "EventCategory_new"[] USING ("preferences"::text::"EventCategory_new"[]);
ALTER TABLE "events" ALTER COLUMN "category" TYPE "EventCategory_new" USING ("category"::text::"EventCategory_new");
ALTER TYPE "EventCategory" RENAME TO "EventCategory_old";
ALTER TYPE "EventCategory_new" RENAME TO "EventCategory";
DROP TYPE "EventCategory_old";
COMMIT;

-- DropIndex
DROP INDEX "users_accountNumber_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "accountName",
DROP COLUMN "accountNumber",
DROP COLUMN "age",
DROP COLUMN "bankName",
DROP COLUMN "firstName",
DROP COLUMN "lastName";
