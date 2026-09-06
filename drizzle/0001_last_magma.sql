CREATE TABLE "day_ledger" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"state" text NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"abandoned" integer DEFAULT 0 NOT NULL,
	"focused_ms" bigint DEFAULT 0 NOT NULL,
	"broke_streak" boolean DEFAULT false NOT NULL,
	"streak_after" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "day_ledger_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "streak_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"freezes" integer DEFAULT 0 NOT NULL,
	"pending_freezes" integer DEFAULT 0 NOT NULL,
	"meter" integer DEFAULT 0 NOT NULL,
	"streak_freezes_granted" integer DEFAULT 0 NOT NULL,
	"last_counted_day" date,
	"last_evaluated_day" date,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"rest_weekdays" integer[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_day" date NOT NULL,
	"end_day" date NOT NULL,
	"quarter" text NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "day_ledger" ADD CONSTRAINT "day_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_state" ADD CONSTRAINT "streak_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation" ADD CONSTRAINT "vacation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vacation_user_start_idx" ON "vacation" USING btree ("user_id","start_day");