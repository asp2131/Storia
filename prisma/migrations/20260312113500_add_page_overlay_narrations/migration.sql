-- CreateTable
CREATE TABLE "page_overlay_narrations" (
    "id" BIGSERIAL NOT NULL,
    "page_id" BIGINT NOT NULL,
    "overlay_element_id" VARCHAR(255) NOT NULL,
    "voice_id" VARCHAR(255) NOT NULL,
    "voice_name" VARCHAR(255),
    "text_content" TEXT NOT NULL,
    "audio_url" VARCHAR(500) NOT NULL,
    "word_timestamps" JSONB,
    "word_pronunciations" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "page_overlay_narrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_overlay_narrations_page_element_voice_idx"
    ON "page_overlay_narrations"("page_id", "overlay_element_id", "voice_id");

-- CreateIndex
CREATE INDEX "page_overlay_narrations_page_id_idx"
    ON "page_overlay_narrations"("page_id");

-- CreateIndex
CREATE INDEX "page_overlay_narrations_voice_id_idx"
    ON "page_overlay_narrations"("voice_id");

-- AddForeignKey
ALTER TABLE "page_overlay_narrations"
    ADD CONSTRAINT "page_overlay_narrations_page_id_fkey"
    FOREIGN KEY ("page_id") REFERENCES "pages"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
