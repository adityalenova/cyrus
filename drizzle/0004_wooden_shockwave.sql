CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"bio" text,
	"goals" text NOT NULL,
	"skill_level" text DEFAULT 'beginner' NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"current_skills" text[] DEFAULT '{}' NOT NULL,
	"desired_skills" text[] DEFAULT '{}' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"availability_hours" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'seeking' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"bio" text,
	"expertise" text[] DEFAULT '{}' NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"availability_hours" integer DEFAULT 5 NOT NULL,
	"max_mentees" integer DEFAULT 2 NOT NULL,
	"current_mentees" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" uuid NOT NULL,
	"mentee_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"compatibility_score" integer DEFAULT 0 NOT NULL,
	"match_details" jsonb,
	"message" text,
	"response_message" text,
	"sessions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feedback" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"target_user_id" uuid,
	"org_id" text,
	"previous_role" text,
	"new_role" text,
	"action" text NOT NULL,
	"ip_address" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"org_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_orgs_login_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("login") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentees" ADD CONSTRAINT "mentees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentee_id_mentees_id_fk" FOREIGN KEY ("mentee_id") REFERENCES "public"."mentees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_audit_logs" ADD CONSTRAINT "role_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_audit_logs" ADD CONSTRAINT "role_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_org_id_orgs_login_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("login") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_org_idx" ON "invitations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "mentees_status_idx" ON "mentees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mentees_skill_level_idx" ON "mentees" USING btree ("skill_level");--> statement-breakpoint
CREATE INDEX "mentors_status_idx" ON "mentors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mentors_timezone_idx" ON "mentors" USING btree ("timezone");--> statement-breakpoint
CREATE INDEX "mentorships_mentor_idx" ON "mentorships" USING btree ("mentor_id","status");--> statement-breakpoint
CREATE INDEX "mentorships_mentee_idx" ON "mentorships" USING btree ("mentee_id","status");--> statement-breakpoint
CREATE INDEX "role_audit_org_idx" ON "role_audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "role_audit_actor_idx" ON "role_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "role_audit_target_idx" ON "role_audit_logs" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "role_audit_created_idx" ON "role_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_org_idx" ON "user_roles" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_org_unique_idx" ON "user_roles" USING btree ("user_id","role_id","org_id");