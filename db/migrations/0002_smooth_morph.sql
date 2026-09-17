CREATE TABLE "drill_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drills" ADD COLUMN "type_id" uuid;--> statement-breakpoint
ALTER TABLE "drill_types" ADD CONSTRAINT "drill_types_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drill_types_owner_name_key" ON "drill_types" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "drill_types_owner_idx" ON "drill_types" USING btree ("owner_id","position");--> statement-breakpoint
ALTER TABLE "drills" ADD CONSTRAINT "drills_type_id_drill_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."drill_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drills_owner_type_idx" ON "drills" USING btree ("owner_id","type_id");