CREATE TABLE "github_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"state" varchar(128) NOT NULL,
	"return_to" varchar(512),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "project_github_remotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"github_owner" varchar(128) NOT NULL,
	"github_repo_name" varchar(128) NOT NULL,
	"remote_url" varchar(512) NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"default_branch" varchar(128) DEFAULT 'main' NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_pushed_at" timestamp with time zone,
	"last_pulled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_github_remotes_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "user_github_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"github_user_id" varchar(64) NOT NULL,
	"github_username" varchar(128) NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"token_iv" varchar(64) NOT NULL,
	"token_tag" varchar(64) NOT NULL,
	"scope" varchar(255),
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_github_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "github_oauth_states" ADD CONSTRAINT "github_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_remotes" ADD CONSTRAINT "project_github_remotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_github_accounts" ADD CONSTRAINT "user_github_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_oauth_states_state_idx" ON "github_oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "github_oauth_states_expires_idx" ON "github_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "project_github_remotes_project_id_idx" ON "project_github_remotes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_github_remotes_repo_idx" ON "project_github_remotes" USING btree ("github_owner","github_repo_name");--> statement-breakpoint
CREATE INDEX "user_github_accounts_user_id_idx" ON "user_github_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_github_accounts_username_idx" ON "user_github_accounts" USING btree ("github_username");