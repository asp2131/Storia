-- Creator-level default text style for Creator Space ("Use style for new text boxes").
-- Nullable and additive: existing rows keep NULL, which means "fall back to the book style".
ALTER TABLE "user" ADD COLUMN "default_text_style" JSONB;
