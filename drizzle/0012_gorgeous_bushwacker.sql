ALTER TABLE "session_activity" ADD COLUMN "tonic_item_id" text;--> statement-breakpoint
ALTER TABLE "session_activity" ADD COLUMN "kills" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_activity" ADD COLUMN "failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_activity" ADD COLUMN "legendary_kills" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_activity" ADD COLUMN "units_gathered" integer DEFAULT 0 NOT NULL;