-- BetterAuth core schema for Supabase
-- Run this in your Supabase SQL Editor

-- User table
CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    role TEXT DEFAULT 'user',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session table
CREATE TABLE IF NOT EXISTS "session" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Account table
CREATE TABLE IF NOT EXISTS "account" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP,
    "refreshTokenExpiresAt" TIMESTAMP,
    scope TEXT,
    "idToken" TEXT,
    password TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Verification table (used by email OTP plugin)
CREATE TABLE IF NOT EXISTS "verification" (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"(identifier);

-- Per-overlay narration tracks (supports multiple voices per page)
-- Requires existing "pages" table from application schema.
CREATE TABLE IF NOT EXISTS page_overlay_narrations (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    overlay_element_id VARCHAR(255) NOT NULL,
    voice_id VARCHAR(255) NOT NULL,
    voice_name VARCHAR(255),
    text_content TEXT NOT NULL,
    audio_url VARCHAR(500) NOT NULL,
    word_timestamps JSONB,
    word_pronunciations JSONB,
    sort_order INT NOT NULL DEFAULT 0,
    inserted_at TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS page_overlay_narrations_page_element_voice_idx
    ON page_overlay_narrations(page_id, overlay_element_id, voice_id);

CREATE INDEX IF NOT EXISTS page_overlay_narrations_page_id_idx
    ON page_overlay_narrations(page_id);

CREATE INDEX IF NOT EXISTS page_overlay_narrations_voice_id_idx
    ON page_overlay_narrations(voice_id);
