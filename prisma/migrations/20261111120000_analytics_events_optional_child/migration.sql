-- Funnel events (app_opened, signup, onboarding, profile creation) happen before
-- a child profile exists. Allow user-only analytics rows.
ALTER TABLE "mobile_analytics_events" ALTER COLUMN "child_profile_id" DROP NOT NULL;
