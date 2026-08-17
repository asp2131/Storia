-- Parent / teacher recorded narration.
-- A personal narration track never touches pages.narration_url; the mobile
-- reader substitutes these rows into PageData at load time.

CREATE TABLE "user_narration_track" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "book_id" BIGINT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_narration_track_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_narration_page" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "page_id" BIGINT NOT NULL,
    "audio_url" VARCHAR(500) NOT NULL,
    "audio_path" VARCHAR(500) NOT NULL,
    "duration_ms" INTEGER,
    "word_timestamps" JSONB,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "alignment_status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "alignment_loss" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_narration_page_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_narration_track_userId_book_id_idx" ON "user_narration_track"("userId", "book_id");
CREATE INDEX "user_narration_track_book_id_idx" ON "user_narration_track"("book_id");
CREATE INDEX "user_narration_page_page_id_idx" ON "user_narration_page"("page_id");
CREATE UNIQUE INDEX "user_narration_page_track_id_page_id_key" ON "user_narration_page"("track_id", "page_id");

ALTER TABLE "user_narration_track"
ADD CONSTRAINT "user_narration_track_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_narration_track"
ADD CONSTRAINT "user_narration_track_book_id_fkey"
FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_narration_page"
ADD CONSTRAINT "user_narration_page_track_id_fkey"
FOREIGN KEY ("track_id") REFERENCES "user_narration_track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_narration_page"
ADD CONSTRAINT "user_narration_page_page_id_fkey"
FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
