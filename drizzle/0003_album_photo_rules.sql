-- Photo exposure in seconds for shutter-speed rule matching (display stays in photo.shutter).
ALTER TABLE "photo" ADD COLUMN IF NOT EXISTS "exposure_seconds" real;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_max_rating_half" smallint;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_iso_min" integer;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_iso_max" integer;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_aperture_min" real;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_aperture_max" real;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_exposure_min" real;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_exposure_max" real;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_focal_length_min" real;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_focal_length_max" real;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_width_min" integer;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_width_max" integer;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_height_min" integer;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_height_max" integer;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_bytes_min" bigint;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_bytes_max" bigint;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_camera" text;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_lens" text;--> statement-breakpoint
ALTER TABLE "album" ADD COLUMN IF NOT EXISTS "rule_mime" text;
