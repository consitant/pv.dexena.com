CREATE TYPE "public"."customer_kind" AS ENUM('private', 'business');--> statement-breakpoint
CREATE SEQUENCE "public"."customer_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"price_ct_per_kwh" real NOT NULL,
	"feed_in_ct_per_kwh" real NOT NULL,
	"self_consumption_pct" real DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tariffs_site_valid_from_uq" UNIQUE("site_id","valid_from"),
	CONSTRAINT "tariffs_price_range" CHECK ("tariffs"."price_ct_per_kwh" >= 0 AND "tariffs"."price_ct_per_kwh" <= 500),
	CONSTRAINT "tariffs_feed_in_range" CHECK ("tariffs"."feed_in_ct_per_kwh" >= 0 AND "tariffs"."feed_in_ct_per_kwh" <= 200),
	CONSTRAINT "tariffs_self_consumption_range" CHECK ("tariffs"."self_consumption_pct" >= 0 AND "tariffs"."self_consumption_pct" <= 100)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "customer_no" text DEFAULT ('K-' || lpad(nextval('customer_no_seq')::text, 5, '0')) NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "kind" "customer_kind" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "salutation" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "contact_person" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "contract_start" date;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "maintenance_contract" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "next_maintenance_on" date;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "peak_power_kwp" real;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "commissioned_on" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_notes_customer_idx" ON "customer_notes" USING btree ("customer_id","created_at");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_customer_idx" ON "audit_log" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_customer_no_unique" UNIQUE("customer_no");