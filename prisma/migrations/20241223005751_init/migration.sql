/*
  Warnings:

  - You are about to drop the column `tier` on the `ticket tiers` table. All the data in the column will be lost.
  - Added the required column `name` to the `ticket tiers` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ticket tiers_tier_idx";

-- AlterTable
ALTER TABLE "ticket tiers" DROP COLUMN "tier",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ticket tiers_name_idx" ON "ticket tiers"("name");
