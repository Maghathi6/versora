CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"path" varchar(1024) NOT NULL,
	"type" varchar(32) NOT NULL,
	"artifact_type" varchar(64) NOT NULL,
	"mime_type" varchar(128),
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_key" varchar(512),
	"hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_project_id_idx" ON "artifacts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "artifacts_parent_id_idx" ON "artifacts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "artifacts_project_parent_idx" ON "artifacts" USING btree ("project_id","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_root_unique_idx" ON "artifacts" USING btree ("project_id","name") WHERE "artifacts"."parent_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_subfolder_unique_idx" ON "artifacts" USING btree ("project_id","parent_id","name") WHERE "artifacts"."parent_id" IS NOT NULL;