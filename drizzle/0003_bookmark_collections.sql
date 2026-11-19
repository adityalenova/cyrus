CREATE TABLE "bookmark_collection_items" (
	"user_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"saved_item_id" uuid NOT NULL,
	CONSTRAINT "bookmark_collection_items_user_id_collection_id_saved_item_id_pk" PRIMARY KEY("user_id","collection_id","saved_item_id")
);
--> statement-breakpoint
CREATE TABLE "bookmark_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"share_token" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_owner_id_idx" ON "bookmark_collections" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_name_idx" ON "bookmark_collections" USING btree ("user_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_share_idx" ON "bookmark_collections" USING btree ("share_token");
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_owner_id_idx" ON "saved_items" USING btree ("user_id","id");
--> statement-breakpoint
ALTER TABLE "bookmark_collection_items" ADD CONSTRAINT "bookmark_collection_items_user_id_collection_id_bookmark_collections_user_id_id_fk" FOREIGN KEY ("user_id","collection_id") REFERENCES "public"."bookmark_collections"("user_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookmark_collection_items" ADD CONSTRAINT "bookmark_collection_items_user_id_saved_item_id_saved_items_user_id_id_fk" FOREIGN KEY ("user_id","saved_item_id") REFERENCES "public"."saved_items"("user_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookmark_collections" ADD CONSTRAINT "bookmark_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
