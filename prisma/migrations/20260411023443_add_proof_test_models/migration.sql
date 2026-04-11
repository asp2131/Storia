-- AlterTable
ALTER TABLE "soundscapes" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::VARCHAR(255)[];

-- CreateTable
CREATE TABLE "child_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "ageBand" TEXT NOT NULL,
    "readingLevel" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_book_progress" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "bookId" BIGINT NOT NULL,
    "currentPage" INTEGER NOT NULL DEFAULT 1,
    "totalPages" INTEGER NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completionCount" INTEGER NOT NULL DEFAULT 0,
    "lastSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_book_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_session" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "bookId" BIGINT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "startPage" INTEGER NOT NULL,
    "endPage" INTEGER NOT NULL,
    "entryIntent" TEXT NOT NULL DEFAULT 'standard',
    "usedNarration" BOOLEAN NOT NULL DEFAULT false,
    "usedPracticeMode" BOOLEAN NOT NULL DEFAULT false,
    "completedBook" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'mobile',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_question" (
    "id" TEXT NOT NULL,
    "bookId" BIGINT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'multiple_choice',
    "sortOrder" INTEGER NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_question_option" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_question_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "bookId" BIGINT NOT NULL,
    "questionId" TEXT NOT NULL,
    "readingSessionId" TEXT,
    "selectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "child_profile_userId_idx" ON "child_profile"("userId");

-- CreateIndex
CREATE INDEX "child_book_progress_childProfileId_idx" ON "child_book_progress"("childProfileId");

-- CreateIndex
CREATE INDEX "child_book_progress_bookId_idx" ON "child_book_progress"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "child_book_progress_childProfileId_bookId_key" ON "child_book_progress"("childProfileId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "reading_session_sessionId_key" ON "reading_session"("sessionId");

-- CreateIndex
CREATE INDEX "reading_session_childProfileId_startedAt_idx" ON "reading_session"("childProfileId", "startedAt");

-- CreateIndex
CREATE INDEX "reading_session_bookId_startedAt_idx" ON "reading_session"("bookId", "startedAt");

-- CreateIndex
CREATE INDEX "reading_session_userId_idx" ON "reading_session"("userId");

-- CreateIndex
CREATE INDEX "book_question_bookId_sortOrder_idx" ON "book_question"("bookId", "sortOrder");

-- CreateIndex
CREATE INDEX "book_question_option_questionId_idx" ON "book_question_option"("questionId");

-- CreateIndex
CREATE INDEX "question_attempt_childProfileId_bookId_answeredAt_idx" ON "question_attempt"("childProfileId", "bookId", "answeredAt");

-- CreateIndex
CREATE INDEX "question_attempt_questionId_idx" ON "question_attempt"("questionId");

-- AddForeignKey
ALTER TABLE "child_profile" ADD CONSTRAINT "child_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_book_progress" ADD CONSTRAINT "child_book_progress_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_session" ADD CONSTRAINT "reading_session_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_question_option" ADD CONSTRAINT "book_question_option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "book_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempt" ADD CONSTRAINT "question_attempt_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempt" ADD CONSTRAINT "question_attempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "book_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
