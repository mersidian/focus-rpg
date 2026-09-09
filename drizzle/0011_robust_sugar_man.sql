CREATE TABLE "collection_log" (
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"best_roll" integer DEFAULT 0 NOT NULL,
	"seen" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "collection_log_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "equipment_instance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"slot" text NOT NULL,
	"style" text NOT NULL,
	"tier" integer NOT NULL,
	"quality" text NOT NULL,
	"archetype" text,
	"rolled" integer NOT NULL,
	"refine" integer DEFAULT 0 NOT NULL,
	"durability" integer DEFAULT 100 NOT NULL,
	"equipped_slot" text,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" text
);
--> statement-breakpoint
CREATE TABLE "farm_plot" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slot" integer NOT NULL,
	"seed_item_id" text,
	"stages_left" integer DEFAULT 0 NOT NULL,
	"planted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_balance" (
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"through_seq" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "inventory_balance_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"session_id" text,
	"seq" bigint NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_activity" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"skill" text NOT NULL,
	"tier" integer NOT NULL,
	"biome" integer,
	"area" integer,
	"style" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skill_state" (
	"user_id" text NOT NULL,
	"skill" text NOT NULL,
	"xp" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "skill_state_user_id_skill_pk" PRIMARY KEY("user_id","skill")
);
--> statement-breakpoint
CREATE TABLE "slaying_contract" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"variant_name" text NOT NULL,
	"biome" integer NOT NULL,
	"required" integer NOT NULL,
	"killed" integer DEFAULT 0 NOT NULL,
	"tier" integer NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallet" (
	"user_id" text PRIMARY KEY NOT NULL,
	"coins" bigint DEFAULT 0 NOT NULL,
	"fuel" integer DEFAULT 0 NOT NULL,
	"fuel_cap" integer DEFAULT 500 NOT NULL,
	"bank_slots" integer DEFAULT 60 NOT NULL,
	"salvage_output" text DEFAULT 'coins' NOT NULL,
	"salvage_below" integer DEFAULT 600 NOT NULL,
	"keep_above" integer DEFAULT 900 NOT NULL,
	"auto_repair" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_progress" (
	"user_id" text NOT NULL,
	"marker" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_progress_user_id_marker_pk" PRIMARY KEY("user_id","marker")
);
--> statement-breakpoint
ALTER TABLE "collection_log" ADD CONSTRAINT "collection_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_instance" ADD CONSTRAINT "equipment_instance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_instance" ADD CONSTRAINT "equipment_instance_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_plot" ADD CONSTRAINT "farm_plot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entry" ADD CONSTRAINT "inventory_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_entry" ADD CONSTRAINT "inventory_entry_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_activity" ADD CONSTRAINT "session_activity_session_id_focus_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."focus_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_activity" ADD CONSTRAINT "session_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_state" ADD CONSTRAINT "skill_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slaying_contract" ADD CONSTRAINT "slaying_contract_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_progress" ADD CONSTRAINT "world_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_user_slot_idx" ON "equipment_instance" USING btree ("user_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_one_per_slot_idx" ON "equipment_instance" USING btree ("user_id","equipped_slot");--> statement-breakpoint
CREATE UNIQUE INDEX "farm_plot_user_slot_idx" ON "farm_plot" USING btree ("user_id","slot");--> statement-breakpoint
CREATE INDEX "inventory_entry_user_seq_idx" ON "inventory_entry" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "inventory_entry_user_item_idx" ON "inventory_entry" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "session_activity_user_idx" ON "session_activity" USING btree ("user_id","resolved_at");--> statement-breakpoint
CREATE INDEX "slaying_user_idx" ON "slaying_contract" USING btree ("user_id","completed_at");