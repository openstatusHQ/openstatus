DROP INDEX "workspace_slug_unique";--> statement-breakpoint
DROP INDEX "workspace_stripe_id_unique";--> statement-breakpoint
DROP INDEX "workspace_id_dsn_unique";--> statement-breakpoint
DROP INDEX "user_tenant_id_unique";--> statement-breakpoint
DROP INDEX "page_slug_unique";--> statement-breakpoint
DROP INDEX "idx_page_subscriber_email_page_active";--> statement-breakpoint
DROP INDEX "idx_page_subscriber_webhook_page_active";--> statement-breakpoint
DROP INDEX "notification_id_monitor_id_crontimestampe";--> statement-breakpoint
DROP INDEX "monitor_status_idx";--> statement-breakpoint
DROP INDEX "incident_monitor_id_started_at_unique";--> statement-breakpoint
DROP INDEX "application_dsn_unique";--> statement-breakpoint
DROP INDEX "viewer_email_unique";--> statement-breakpoint
DROP INDEX "api_key_prefix_unique";--> statement-breakpoint
DROP INDEX "api_key_hashed_token_unique";--> statement-breakpoint
DROP INDEX "api_key_prefix_idx";--> statement-breakpoint
DROP INDEX "page_component_page_id_monitor_id_unique";--> statement-breakpoint
ALTER TABLE `page_subscriber` ALTER COLUMN "email" TO "email" text;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_slug_unique` ON `workspace` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_stripe_id_unique` ON `workspace` (`stripe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_id_dsn_unique` ON `workspace` (`id`,`dsn`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_tenant_id_unique` ON `user` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_slug_unique` ON `page` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_subscriber_email_page_active` ON `page_subscriber` (LOWER("email"),`page_id`) WHERE "page_subscriber"."unsubscribed_at" IS NULL AND "page_subscriber"."channel_type" = 'email';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_page_subscriber_webhook_page_active` ON `page_subscriber` (`webhook_url`,`page_id`) WHERE "page_subscriber"."unsubscribed_at" IS NULL AND "page_subscriber"."channel_type" = 'webhook';--> statement-breakpoint
CREATE UNIQUE INDEX `notification_id_monitor_id_crontimestampe` ON `notification_trigger` (`notification_id`,`monitor_id`,`cron_timestamp`);--> statement-breakpoint
CREATE INDEX `monitor_status_idx` ON `monitor_status` (`monitor_id`,`region`);--> statement-breakpoint
CREATE UNIQUE INDEX `incident_monitor_id_started_at_unique` ON `incident` (`monitor_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_dsn_unique` ON `application` (`dsn`);--> statement-breakpoint
CREATE UNIQUE INDEX `viewer_email_unique` ON `viewer` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_prefix_unique` ON `api_key` (`prefix`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_hashed_token_unique` ON `api_key` (`hashed_token`);--> statement-breakpoint
CREATE INDEX `api_key_prefix_idx` ON `api_key` (`prefix`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_component_page_id_monitor_id_unique` ON `page_component` (`page_id`,`monitor_id`);--> statement-breakpoint
ALTER TABLE `page_subscriber` ADD `source` text DEFAULT 'self_signup' NOT NULL;--> statement-breakpoint
ALTER TABLE `page_subscriber` ADD `name` text;