-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_organizerId_fkey";

-- DropForeignKey
ALTER TABLE "organizers" DROP CONSTRAINT "organizers_userId_fkey";

-- DropForeignKey
ALTER TABLE "ticket tiers" DROP CONSTRAINT "ticket tiers_eventId_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_attendee_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_eventId_fkey";

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_attendee_fkey" FOREIGN KEY ("attendee") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket tiers" ADD CONSTRAINT "ticket tiers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
