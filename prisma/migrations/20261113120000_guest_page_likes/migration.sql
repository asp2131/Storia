-- Likes from readers who have not signed up. Deliberately a daily counter with
-- no user, device, session or IP columns: these readers have no parent consent,
-- so nothing that could identify a child is stored.
CREATE TABLE "guest_page_likes" (
    "book_id" BIGINT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "bursts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "guest_page_likes_pkey" PRIMARY KEY ("book_id","page_number","day")
);

CREATE INDEX "guest_page_likes_day_idx" ON "guest_page_likes"("day");

ALTER TABLE "guest_page_likes" ADD CONSTRAINT "guest_page_likes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The table sits in the public schema, which Supabase exposes through its REST
-- API. With row level security on and no policies, only the server (table
-- owner) can read or write it.
ALTER TABLE "guest_page_likes" ENABLE ROW LEVEL SECURITY;
