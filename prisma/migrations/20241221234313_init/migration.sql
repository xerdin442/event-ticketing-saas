-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ACTIVE', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'SOLD_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('TECH', 'HEALTH', 'ENTERTAINMENT', 'FASHION', 'SPORTS', 'BUSINESS', 'CONFERENCE', 'OTHERS');

-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "age" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "profileImage" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "twoFASecret" TEXT,
    "twoFAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tier" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "accessKey" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "attendee" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizers" (
    "id" SERIAL NOT NULL,
    "name" TEXT[],
    "email" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "recipientCode" TEXT,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "twitter" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "organizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket tiers" (
    "id" SERIAL NOT NULL,
    "tier" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "discountPrice" INTEGER,
    "discountExpiration" TIMESTAMP(3),
    "numberOfDiscountTickets" INTEGER,
    "discountStatus" "DiscountStatus",
    "benefits" TEXT,
    "totalNumberOfTickets" INTEGER NOT NULL,
    "soldOut" BOOLEAN NOT NULL DEFAULT false,
    "eventId" INTEGER NOT NULL,

    CONSTRAINT "ticket tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "ageRestriction" INTEGER,
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "numberOfShares" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "poster" TEXT NOT NULL,
    "media" TEXT[],
    "organizerId" INTEGER NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Attendees" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_accountNumber_key" ON "users"("accountNumber");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_accessKey_key" ON "tickets"("accessKey");

-- CreateIndex
CREATE INDEX "tickets_attendee_idx" ON "tickets"("attendee");

-- CreateIndex
CREATE INDEX "tickets_eventId_idx" ON "tickets"("eventId");

-- CreateIndex
CREATE INDEX "tickets_accessKey_idx" ON "tickets"("accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "organizers_accountNumber_key" ON "organizers"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "organizers_userId_key" ON "organizers"("userId");

-- CreateIndex
CREATE INDEX "organizers_userId_idx" ON "organizers"("userId");

-- CreateIndex
CREATE INDEX "ticket tiers_tier_idx" ON "ticket tiers"("tier");

-- CreateIndex
CREATE INDEX "events_category_idx" ON "events"("category");

-- CreateIndex
CREATE UNIQUE INDEX "_Attendees_AB_unique" ON "_Attendees"("A", "B");

-- CreateIndex
CREATE INDEX "_Attendees_B_index" ON "_Attendees"("B");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_attendee_fkey" FOREIGN KEY ("attendee") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket tiers" ADD CONSTRAINT "ticket tiers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Attendees" ADD CONSTRAINT "_Attendees_A_fkey" FOREIGN KEY ("A") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Attendees" ADD CONSTRAINT "_Attendees_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
