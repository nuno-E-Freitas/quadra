CREATE TABLE "quartet_members" (
	"quartet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "quartet_members_quartet_id_user_id_pk" PRIMARY KEY("quartet_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "quartets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_session_items" ADD COLUMN "quartet_id" uuid;--> statement-breakpoint
ALTER TABLE "quartet_members" ADD CONSTRAINT "quartet_members_quartet_id_quartets_id_fk" FOREIGN KEY ("quartet_id") REFERENCES "public"."quartets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quartet_members" ADD CONSTRAINT "quartet_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quartets" ADD CONSTRAINT "quartets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quartet_members_user_idx" ON "quartet_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quartets_team_idx" ON "quartets" USING btree ("team_id","position");--> statement-breakpoint
ALTER TABLE "training_session_items" ADD CONSTRAINT "training_session_items_quartet_id_quartets_id_fk" FOREIGN KEY ("quartet_id") REFERENCES "public"."quartets"("id") ON DELETE set null ON UPDATE no action;