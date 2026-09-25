-- CreateEnum
CREATE TYPE "MidtermStatus" AS ENUM ('PENDING', 'CONTINUE', 'STOPPED');

-- CreateEnum
CREATE TYPE "ScoreChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "midterm_at" TIMESTAMP(3),
ADD COLUMN     "midterm_note" TEXT,
ADD COLUMN     "midterm_status" "MidtermStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "score_change_requests" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ScoreChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "score_change_requests_group_id_status_idx" ON "score_change_requests"("group_id", "status");

-- AddForeignKey
ALTER TABLE "score_change_requests" ADD CONSTRAINT "score_change_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_change_requests" ADD CONSTRAINT "score_change_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_change_requests" ADD CONSTRAINT "score_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
