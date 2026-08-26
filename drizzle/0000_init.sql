CREATE TYPE "public"."album_kind" AS ENUM('collection', 'dated', 'best_of');--> statement-breakpoint
CREATE TYPE "public"."album_photo_mode" AS ENUM('include', 'exclude');--> statement-breakpoint
CREATE TYPE "public"."album_source" AS ENUM('manual', 'rule');--> statement-breakpoint
CREATE TYPE "public"."album_visibility" AS ENUM('public', 'unlisted', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('uploading', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"visibility" "album_visibility" DEFAULT 'restricted' NOT NULL,
	"kind" "album_kind" DEFAULT 'collection' NOT NULL,
	"source" "album_source" DEFAULT 'manual' NOT NULL,
	"rule_date_from" timestamp with time zone,
	"rule_date_to" timestamp with time zone,
	"rule_min_rating_half" smallint,
	"contributes_to_best_of" boolean DEFAULT false NOT NULL,
	"cover_photo_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_slug_unique" UNIQUE("slug"),
	CONSTRAINT "album_rule_min_rating_range" CHECK ("album"."rule_min_rating_half" is null or ("album"."rule_min_rating_half" >= 0 and "album"."rule_min_rating_half" <= 20))
);
--> statement-breakpoint
CREATE TABLE "album_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"group_id" uuid,
	"user_id" text,
	"can_download_originals" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_access_exactly_one_subject" CHECK (num_nonnulls("album_access"."group_id", "album_access"."user_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "album_photo" (
	"album_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"mode" "album_photo_mode" DEFAULT 'include' NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_photo_album_id_photo_id_pk" PRIMARY KEY("album_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "album_photo_resolved" (
	"album_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "album_photo_resolved_album_id_photo_id_pk" PRIMARY KEY("album_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "album_rule_tag" (
	"album_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "album_rule_tag_album_id_tag_id_pk" PRIMARY KEY("album_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_key" text NOT NULL,
	"filename" text NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" bigint,
	"mime" text,
	"taken_at" timestamp with time zone,
	"camera" text,
	"lens" text,
	"iso" integer,
	"aperture" real,
	"shutter" text,
	"focal_length" real,
	"gps_latitude" real,
	"gps_longitude" real,
	"thumbhash" text,
	"caption" text,
	"status" "photo_status" DEFAULT 'uploading' NOT NULL,
	"admin_rating_half" smallint,
	"rating_avg" numeric(4, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_admin_rating_half_range" CHECK ("photo"."admin_rating_half" is null or ("photo"."admin_rating_half" >= 0 and "photo"."admin_rating_half" <= 20))
);
--> statement-breakpoint
CREATE TABLE "photo_rating" (
	"photo_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"value_half" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_rating_photo_id_user_id_pk" PRIMARY KEY("photo_id","user_id"),
	CONSTRAINT "photo_rating_value_half_range" CHECK ("photo_rating"."value_half" >= 0 and "photo_rating"."value_half" <= 20)
);
--> statement-breakpoint
CREATE TABLE "photo_tag" (
	"photo_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "photo_tag_photo_id_tag_id_pk" PRIMARY KEY("photo_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "photo_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" text NOT NULL,
	"key" text NOT NULL,
	"bytes" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album" ADD CONSTRAINT "album_cover_photo_id_photo_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_access" ADD CONSTRAINT "album_access_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_access" ADD CONSTRAINT "album_access_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_access" ADD CONSTRAINT "album_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_photo" ADD CONSTRAINT "album_photo_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_photo" ADD CONSTRAINT "album_photo_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_photo_resolved" ADD CONSTRAINT "album_photo_resolved_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_photo_resolved" ADD CONSTRAINT "album_photo_resolved_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_rule_tag" ADD CONSTRAINT "album_rule_tag_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_rule_tag" ADD CONSTRAINT "album_rule_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_rating" ADD CONSTRAINT "photo_rating_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_rating" ADD CONSTRAINT "photo_rating_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_tag" ADD CONSTRAINT "photo_tag_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_tag" ADD CONSTRAINT "photo_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_variant" ADD CONSTRAINT "photo_variant_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "album_single_best_of" ON "album" USING btree ("kind") WHERE "album"."kind" = 'best_of';--> statement-breakpoint
CREATE INDEX "album_kind_idx" ON "album" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "album_visibility_idx" ON "album" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "album_rule_date_from_idx" ON "album" USING btree ("rule_date_from");--> statement-breakpoint
CREATE UNIQUE INDEX "album_access_group_unique" ON "album_access" USING btree ("album_id","group_id") WHERE "album_access"."group_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "album_access_user_unique" ON "album_access" USING btree ("album_id","user_id") WHERE "album_access"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "album_access_album_idx" ON "album_access" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "album_photo_photo_idx" ON "album_photo" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "album_photo_resolved_photo_idx" ON "album_photo_resolved" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "album_photo_resolved_album_sort_idx" ON "album_photo_resolved" USING btree ("album_id","sort_index");--> statement-breakpoint
CREATE INDEX "album_rule_tag_tag_idx" ON "album_rule_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "group_member_user_idx" ON "group_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "photo_taken_at_id_idx" ON "photo" USING btree ("taken_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "photo_status_idx" ON "photo" USING btree ("status");--> statement-breakpoint
CREATE INDEX "photo_admin_rating_idx" ON "photo" USING btree ("admin_rating_half");--> statement-breakpoint
CREATE INDEX "photo_tag_tag_idx" ON "photo_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_variant_unique" ON "photo_variant" USING btree ("photo_id","width","format");--> statement-breakpoint
CREATE INDEX "photo_variant_photo_idx" ON "photo_variant" USING btree ("photo_id");