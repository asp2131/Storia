-- Enable extensions required by indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "oban_job_state" AS ENUM ('available', 'scheduled', 'executing', 'retryable', 'completed', 'discarded', 'cancelled');

-- CreateTable
CREATE TABLE "books" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "pdf_url" VARCHAR(255),
    "total_pages" INTEGER DEFAULT 0,
    "source_type" VARCHAR(255) NOT NULL DEFAULT 'public_domain',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "processing_status" VARCHAR(255) DEFAULT 'pending',
    "processing_cost" DECIMAL(10,4),
    "processing_error" TEXT,
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "cover_url" VARCHAR(255),
    "description" TEXT,
    "book_type" VARCHAR(255) NOT NULL DEFAULT 'pdf_book',

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oban_jobs" (
    "id" BIGSERIAL NOT NULL,
    "state" "oban_job_state" NOT NULL DEFAULT 'available',
    "queue" TEXT NOT NULL DEFAULT 'default',
    "worker" TEXT NOT NULL,
    "args" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 20,
    "inserted_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "scheduled_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "attempted_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "attempted_by" TEXT[],
    "discarded_at" TIMESTAMP(6),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta" JSONB DEFAULT '{}',
    "cancelled_at" TIMESTAMP(6),

    CONSTRAINT "oban_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oban_peers" (
    "name" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "started_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "oban_peers_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" BIGSERIAL NOT NULL,
    "book_id" BIGINT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "text_content" TEXT,
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "scene_id" BIGINT,
    "image_url" VARCHAR(255),
    "narration_url" VARCHAR(255),
    "narration_timestamps" JSONB,
    "word_pronunciations" JSONB,
    "illustration_prompt" TEXT,
    "text_overlay" JSONB,
    "composited_image_url" VARCHAR(500),
    "composited_image_path" VARCHAR(500),
    "composited_at" TIMESTAMP(0),
    "composited_by" VARCHAR(255),

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_audio_assignments" (
    "id" BIGSERIAL NOT NULL,
    "page_id" BIGINT NOT NULL,
    "audio_url" VARCHAR(255) NOT NULL,
    "audio_type" VARCHAR(50) NOT NULL,
    "scope" VARCHAR(50) NOT NULL,
    "range_start" INTEGER,
    "range_end" INTEGER,
    "volume" DOUBLE PRECISION,
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "page_audio_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "book_id" BIGINT NOT NULL,
    "current_page" INTEGER NOT NULL DEFAULT 1,
    "last_read_at" TIMESTAMP(0),
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" BIGSERIAL NOT NULL,
    "book_id" BIGINT NOT NULL,
    "start_page" INTEGER NOT NULL,
    "end_page" INTEGER NOT NULL,
    "descriptors" JSONB DEFAULT '{}',
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "scene_number" INTEGER,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_migrations" (
    "version" BIGINT NOT NULL,
    "inserted_at" TIMESTAMP(0),

    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "soundscapes" (
    "id" BIGSERIAL NOT NULL,
    "scene_id" BIGINT,
    "audio_url" VARCHAR(255) NOT NULL,
    "source_type" VARCHAR(255) NOT NULL DEFAULT 'curated',
    "confidence_score" DOUBLE PRECISION,
    "admin_approved" BOOLEAN NOT NULL DEFAULT false,
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "generation_prompt" TEXT,
    "tags" VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR(255)[],

    CONSTRAINT "soundscapes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "subscription_tier" VARCHAR(255) NOT NULL DEFAULT 'free',
    "stripe_customer_id" VARCHAR(255),
    "subscription_status" VARCHAR(255),
    "role" VARCHAR(255) NOT NULL DEFAULT 'user',
    "inserted_at" TIMESTAMP(0) NOT NULL,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token" BYTEA NOT NULL,
    "context" VARCHAR(255) NOT NULL,
    "sent_to" VARCHAR(255),
    "inserted_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "users_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reader_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "books_author_gin_idx" ON "books" USING GIN ("author" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "books_is_published_index" ON "books"("is_published");

-- CreateIndex
CREATE INDEX "books_is_published_updated_at_index" ON "books"("is_published", "updated_at");

-- CreateIndex
CREATE INDEX "books_metadata_index" ON "books" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "books_processing_status_index" ON "books"("processing_status");

-- CreateIndex
CREATE INDEX "books_source_type_index" ON "books"("source_type");

-- CreateIndex
CREATE INDEX "books_title_gin_idx" ON "books" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "oban_jobs_args_index" ON "oban_jobs" USING GIN ("args");

-- CreateIndex
CREATE INDEX "oban_jobs_meta_index" ON "oban_jobs" USING GIN ("meta");

-- CreateIndex
CREATE INDEX "oban_jobs_state_queue_priority_scheduled_at_id_index" ON "oban_jobs"("state", "queue", "priority", "scheduled_at", "id");

-- CreateIndex
CREATE INDEX "pages_book_id_index" ON "pages"("book_id");

-- CreateIndex
CREATE INDEX "pages_scene_id_index" ON "pages"("scene_id");

-- CreateIndex
CREATE INDEX "pages_composited_image_url_index" ON "pages"("composited_image_url");

-- CreateIndex
CREATE UNIQUE INDEX "pages_book_id_page_number_index" ON "pages"("book_id", "page_number");

-- CreateIndex
CREATE INDEX "page_audio_assignments_page_id_index" ON "page_audio_assignments"("page_id");

-- CreateIndex
CREATE INDEX "page_audio_assignments_audio_type_index" ON "page_audio_assignments"("audio_type");

-- CreateIndex
CREATE INDEX "reading_progress_book_id_index" ON "reading_progress"("book_id");

-- CreateIndex
CREATE INDEX "reading_progress_user_id_index" ON "reading_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_user_id_book_id_index" ON "reading_progress"("user_id", "book_id");

-- CreateIndex
CREATE INDEX "scenes_book_id_index" ON "scenes"("book_id");

-- CreateIndex
CREATE INDEX "scenes_book_id_scene_number_index" ON "scenes"("book_id", "scene_number");

-- CreateIndex
CREATE INDEX "scenes_book_id_start_page_end_page_index" ON "scenes"("book_id", "start_page", "end_page");

-- CreateIndex
CREATE INDEX "soundscapes_admin_approved_index" ON "soundscapes"("admin_approved");

-- CreateIndex
CREATE INDEX "soundscapes_generation_prompt_gin_idx" ON "soundscapes" USING GIN ("generation_prompt" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "soundscapes_scene_id_index" ON "soundscapes"("scene_id");

-- CreateIndex
CREATE INDEX "soundscapes_source_type_index" ON "soundscapes"("source_type");

-- CreateIndex
CREATE INDEX "soundscapes_tags_gin_idx" ON "soundscapes" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_index" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_index" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_tokens_user_id_index" ON "users_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tokens_context_token_index" ON "users_tokens"("context", "token");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "reader_feedback_userId_idx" ON "reader_feedback"("userId");

-- CreateIndex
CREATE INDEX "reader_feedback_createdAt_idx" ON "reader_feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "page_audio_assignments" ADD CONSTRAINT "page_audio_assignments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "soundscapes" ADD CONSTRAINT "soundscapes_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users_tokens" ADD CONSTRAINT "users_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_feedback" ADD CONSTRAINT "reader_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reading_progress" ADD CONSTRAINT "user_reading_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
