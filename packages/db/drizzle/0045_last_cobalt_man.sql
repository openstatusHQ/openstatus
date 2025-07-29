DROP INDEX IF EXISTS "workspace_slug_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_stripe_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_id_dsn_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "user_tenant_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "page_slug_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "notification_id_monitor_id_crontimestampe";--> statement-breakpoint
DROP INDEX IF EXISTS "monitor_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "incident_monitor_id_started_at_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "application_dsn_unique";--> statement-breakpoint
ALTER TABLE `page` ALTER COLUMN "force_theme" TO "force_theme" text NOT NULL DEFAULT 'light';--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_slug_unique` ON `workspace` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_stripe_id_unique` ON `workspace` (`stripe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_id_dsn_unique` ON `workspace` (`id`,`dsn`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_tenant_id_unique` ON `user` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_slug_unique` ON `page` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_id_monitor_id_crontimestampe` ON `notification_trigger` (`notification_id`,`monitor_id`,`cron_timestamp`);--> statement-breakpoint
CREATE INDEX `monitor_status_idx` ON `monitor_status` (`monitor_id`,`region`);--> statement-breakpoint
CREATE UNIQUE INDEX `incident_monitor_id_started_at_unique` ON `incident` (`monitor_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_dsn_unique` ON `application` (`dsn`);