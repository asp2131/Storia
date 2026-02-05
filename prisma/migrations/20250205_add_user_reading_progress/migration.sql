-- CreateTable
CREATE TABLE "user_reading_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" BIGINT NOT NULL,
    "currentPage" INTEGER NOT NULL DEFAULT 1,
    "totalPages" INTEGER NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_reading_progress_userId_bookId_key" ON "user_reading_progress"("userId", "bookId");

-- CreateIndex
CREATE INDEX "user_reading_progress_userId_idx" ON "user_reading_progress"("userId");

-- CreateIndex
CREATE INDEX "user_reading_progress_bookId_idx" ON "user_reading_progress"("bookId");

-- CreateIndex
CREATE INDEX "user_reading_progress_lastReadAt_idx" ON "user_reading_progress"("lastReadAt");
