CREATE TABLE "artifact_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"target_artifact_id" uuid NOT NULL,
	"relationship_type" varchar(32) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_relationships_unique_type_idx" UNIQUE("project_id","source_artifact_id","target_artifact_id","relationship_type")
);
--> statement-breakpoint
CREATE TABLE "project_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" varchar(128),
	"summary" varchar(500) NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_impact_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"impact_key" varchar(255) NOT NULL,
	"status" varchar(32) NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_impact_reviews_unique_key" UNIQUE("project_id","impact_key")
);
--> statement-breakpoint
ALTER TABLE "artifact_relationships" ADD CONSTRAINT "artifact_relationships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_relationships" ADD CONSTRAINT "artifact_relationships_source_artifact_id_artifacts_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_relationships" ADD CONSTRAINT "artifact_relationships_target_artifact_id_artifacts_id_fk" FOREIGN KEY ("target_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_impact_reviews" ADD CONSTRAINT "project_impact_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_impact_reviews" ADD CONSTRAINT "project_impact_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_relationships_project_id_idx" ON "artifact_relationships" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "artifact_relationships_source_idx" ON "artifact_relationships" USING btree ("source_artifact_id");--> statement-breakpoint
CREATE INDEX "artifact_relationships_target_idx" ON "artifact_relationships" USING btree ("target_artifact_id");--> statement-breakpoint
CREATE INDEX "artifact_relationships_type_idx" ON "artifact_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "project_activities_project_created_idx" ON "project_activities" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "project_activities_actor_idx" ON "project_activities" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "project_impact_reviews_project_idx" ON "project_impact_reviews" USING btree ("project_id");