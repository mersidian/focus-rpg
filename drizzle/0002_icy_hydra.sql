CREATE TABLE "achievement_unlock" (
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"freezes_awarded" integer DEFAULT 0 NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievement_unlock_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "birthday" date;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "holidays" date[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "worn_title" text;--> statement-breakpoint
ALTER TABLE "achievement_unlock" ADD CONSTRAINT "achievement_unlock_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievement_unlock_user_idx" ON "achievement_unlock" USING btree ("user_id","unlocked_at");