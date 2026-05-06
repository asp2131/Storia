CREATE TABLE "page_overlay_text_entries" (
    "id" BIGSERIAL NOT NULL,
    "page_id" BIGINT NOT NULL,
    "text_content" TEXT NOT NULL,
    "include_in_narration" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "bbox" JSONB,
    "confidence" DOUBLE PRECISION,
    "source" VARCHAR(32) NOT NULL DEFAULT 'ocr',
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "page_overlay_text_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_overlay_text_entries_page_id_idx" ON "page_overlay_text_entries"("page_id");
CREATE INDEX "page_overlay_text_entries_page_sort_idx" ON "page_overlay_text_entries"("page_id", "sort_order");

ALTER TABLE "page_overlay_text_entries"
ADD CONSTRAINT "page_overlay_text_entries_page_id_fkey"
FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
