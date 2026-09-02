ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_unrated_only" boolean DEFAULT false NOT NULL;
