-- AlterTable
ALTER TABLE "soundscapes" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::VARCHAR(255)[];

-- CreateTable
CREATE TABLE "book_pronunciations" (
    "id" BIGSERIAL NOT NULL,
    "book_id" BIGINT NOT NULL,
    "normalized_word" VARCHAR(255) NOT NULL,
    "display_word" VARCHAR(255),
    "phonetic_display" TEXT,
    "syllables" JSONB,
    "breakdown_segments" JSONB,
    "full_word_url" VARCHAR(500),
    "breakdown_url" VARCHAR(500),
    "source" VARCHAR(32) NOT NULL DEFAULT 'tts',
    "status" VARCHAR(32) NOT NULL DEFAULT 'generated',
    "confidence" DOUBLE PRECISION,
    "human_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(0),
    "reviewed_at" TIMESTAMP(0),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "book_pronunciations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_pronunciations_book_id_idx" ON "book_pronunciations"("book_id");

-- CreateIndex
CREATE INDEX "book_pronunciations_human_reviewed_idx" ON "book_pronunciations"("human_reviewed");

-- CreateIndex
CREATE INDEX "book_pronunciations_book_id_status_idx" ON "book_pronunciations"("book_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "book_pronunciations_book_id_normalized_word_idx" ON "book_pronunciations"("book_id", "normalized_word");

-- AddForeignKey
ALTER TABLE "book_pronunciations" ADD CONSTRAINT "book_pronunciations_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
