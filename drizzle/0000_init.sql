CREATE TYPE "public"."device_kind" AS ENUM('gateway', 'esp32');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'customer');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_yield" (
	"inverter_id" uuid NOT NULL,
	"day" date NOT NULL,
	"energy_wh" integer NOT NULL,
	"max_power_w" real,
	CONSTRAINT "daily_yield_inverter_id_day_pk" PRIMARY KEY("inverter_id","day")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "device_kind" DEFAULT 'gateway' NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"firmware_version" text,
	"last_seen_at" timestamp with time zone,
	"last_heartbeat" jsonb,
	"poll_interval_s" integer DEFAULT 300 NOT NULL,
	"offline_after_min" integer DEFAULT 15 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "firmware_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"blob_url" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"released" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firmware_releases_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "inverters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"port" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"name" text,
	"model" text,
	"rated_power_w" integer,
	"site_id" uuid,
	"customer_id" uuid,
	"connected" boolean DEFAULT false NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inverters_ref_unique" UNIQUE("ref"),
	CONSTRAINT "inverters_device_port_uq" UNIQUE("device_id","port"),
	CONSTRAINT "inverters_port_range" CHECK ("inverters"."port" BETWEEN 18900 AND 18999)
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"inverter_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"mode" smallint,
	"ac_power_w" real,
	"energy_today_wh" integer,
	"energy_total_kwh" integer,
	"temperature_c" real,
	"max_power_today_w" real,
	"ac" jsonb,
	"pv" jsonb,
	"raw" jsonb,
	CONSTRAINT "measurements_inverter_id_ts_pk" PRIMARY KEY("inverter_id","ts")
);
--> statement-breakpoint
CREATE TABLE "monthly_yield" (
	"inverter_id" uuid NOT NULL,
	"month" date NOT NULL,
	"energy_wh" bigint NOT NULL,
	CONSTRAINT "monthly_yield_inverter_id_month_pk" PRIMARY KEY("inverter_id","month")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lower" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_customer_role" CHECK (("users"."role" = 'admin') OR ("users"."customer_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_yield" ADD CONSTRAINT "daily_yield_inverter_id_inverters_id_fk" FOREIGN KEY ("inverter_id") REFERENCES "public"."inverters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inverters" ADD CONSTRAINT "inverters_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inverters" ADD CONSTRAINT "inverters_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inverters" ADD CONSTRAINT "inverters_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_inverter_id_inverters_id_fk" FOREIGN KEY ("inverter_id") REFERENCES "public"."inverters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_yield" ADD CONSTRAINT "monthly_yield_inverter_id_inverters_id_fk" FOREIGN KEY ("inverter_id") REFERENCES "public"."inverters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inverters_customer_idx" ON "inverters" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "inverters_site_idx" ON "inverters" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "measurements_inverter_ts_desc_idx" ON "measurements" USING btree ("inverter_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sites_customer_idx" ON "sites" USING btree ("customer_id");