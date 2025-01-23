/*
  Warnings:

  - You are about to drop the column `numberOfShares` on the `events` table. All the data in the column will be lost.
  - Made the column `recipientCode` on table `organizers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "numberOfShares";

-- AlterTable
ALTER TABLE "organizers" ALTER COLUMN "recipientCode" SET NOT NULL;
