-- Web readers who have not signed up. Their events carry anon_id, a random
-- UUID kept in the browser's localStorage: no user, IP or user agent is stored,
-- so it identifies a device's reading, not a person.
ALTER TABLE "mobile_analytics_events" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "mobile_analytics_events" ADD COLUMN "anon_id" TEXT;
ALTER TABLE "mobile_analytics_events"
  ADD CONSTRAINT "mobile_analytics_events_actor_check"
  CHECK ("user_id" IS NOT NULL OR "anon_id" IS NOT NULL);

CREATE INDEX "mobile_analytics_events_anon_id_occurred_at_idx"
  ON "mobile_analytics_events"("anon_id", "occurred_at");
