CREATE TABLE "prestige_cycle" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"reached_fifty_at" timestamp with time zone,
	"prestiged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"abandons" integer DEFAULT 0 NOT NULL,
	"xp_at_reset" integer DEFAULT 0 NOT NULL,
	"level_at_reset" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestige_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"cycle_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reached_fifty_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prestige_cycle" ADD CONSTRAINT "prestige_cycle_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestige_state" ADD CONSTRAINT "prestige_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prestige_cycle_user_idx" ON "prestige_cycle" USING btree ("user_id","ordinal");