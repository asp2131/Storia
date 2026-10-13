-- AlterTable
ALTER TABLE "child_profile" ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "parentGoal" TEXT,
ADD COLUMN     "readingTime" TEXT;
