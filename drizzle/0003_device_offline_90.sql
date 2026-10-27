ALTER TABLE "devices" ALTER COLUMN "offline_after_min" SET DEFAULT 90;--> statement-breakpoint
UPDATE "devices" SET "offline_after_min" = 90 WHERE "offline_after_min" < 90;