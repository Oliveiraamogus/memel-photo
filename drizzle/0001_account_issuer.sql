-- Better Auth 1.7 requires account.issuer (OIDC account key with account_id).
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = 'local:' || "provider_id" WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id");
