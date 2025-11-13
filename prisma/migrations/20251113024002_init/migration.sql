/*
  Warnings:

  - You are about to drop the column `profileImage` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `twoFAEnabled` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `twoFASecret` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "profileImage",
DROP COLUMN "twoFAEnabled",
DROP COLUMN "twoFASecret";
