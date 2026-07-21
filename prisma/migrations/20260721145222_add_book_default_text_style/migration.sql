-- AlterTable
ALTER TABLE "books" ADD COLUMN     "default_text_style" JSONB;

-- AlterTable
ALTER TABLE "soundscapes" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::VARCHAR(255)[];
