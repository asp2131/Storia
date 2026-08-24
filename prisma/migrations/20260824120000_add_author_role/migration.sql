-- Author onboarding: book ownership, review workflow, invite-only author role.

ALTER TABLE "books"
  ADD COLUMN "owner_id" TEXT,
  ADD COLUMN "review_status" VARCHAR(16) NOT NULL DEFAULT 'draft',
  ADD COLUMN "review_note" TEXT,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

-- Every pre-existing book is staff-created and already vetted; mark the live
-- ones approved so they don't show up in the review queue.
UPDATE "books" SET "review_status" = 'approved' WHERE "is_published" = true;

CREATE INDEX "books_owner_id_index" ON "books"("owner_id");
CREATE INDEX "books_review_status_index" ON "books"("review_status");

ALTER TABLE "books"
  ADD CONSTRAINT "books_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "author_invite" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "note" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_user_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "author_invite_token_hash_key" ON "author_invite"("token_hash");
CREATE INDEX "author_invite_email_idx" ON "author_invite"("email");
