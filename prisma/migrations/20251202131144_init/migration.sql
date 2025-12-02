/*
  Warnings:

  - Added the required column `recipientCode` to the `listings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "recipientCode" TEXT NOT NULL;
