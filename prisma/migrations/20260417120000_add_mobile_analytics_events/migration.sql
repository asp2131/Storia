-- CreateTable
CREATE TABLE "mobile_analytics_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "child_profile_id" TEXT NOT NULL,
    "book_id" BIGINT,
    "session_id" TEXT,
    "event_name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mobile',
    "properties" JSONB DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_analytics_events_user_id_idx" ON "mobile_analytics_events"("user_id");

-- CreateIndex
CREATE INDEX "mobile_analytics_events_child_profile_id_idx" ON "mobile_analytics_events"("child_profile_id");

-- CreateIndex
CREATE INDEX "mobile_analytics_events_book_id_idx" ON "mobile_analytics_events"("book_id");

-- CreateIndex
CREATE INDEX "mobile_analytics_events_session_id_idx" ON "mobile_analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "mobile_analytics_events_event_name_idx" ON "mobile_analytics_events"("event_name");

-- CreateIndex
CREATE INDEX "mobile_analytics_events_child_profile_id_occurred_at_idx" ON "mobile_analytics_events"("child_profile_id", "occurred_at");

-- CreateIndex
CREATE INDEX "mobile_analytics_events_user_id_occurred_at_idx" ON "mobile_analytics_events"("user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "mobile_analytics_events" ADD CONSTRAINT "mobile_analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_analytics_events" ADD CONSTRAINT "mobile_analytics_events_child_profile_id_fkey" FOREIGN KEY ("child_profile_id") REFERENCES "child_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
