/*
  Warnings:

  - You are about to drop the `_Attendees` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_Attendees" DROP CONSTRAINT "_Attendees_A_fkey";

-- DropForeignKey
ALTER TABLE "_Attendees" DROP CONSTRAINT "_Attendees_B_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_attendee_fkey";

-- DropIndex
DROP INDEX "tickets_attendee_idx";

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "attendee" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "_Attendees";
