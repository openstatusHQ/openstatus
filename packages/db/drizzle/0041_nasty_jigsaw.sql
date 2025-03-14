CREATE TABLE `notification_trigger` (
	`id` integer PRIMARY KEY NOT NULL,
	`monitor_id` integer,
	`notification_id` integer,
	`cron_timestamp` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`notification_id`) REFERENCES `notification`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_id_monitor_id_crontimestampe` ON `notification_trigger` (`notification_id`,`monitor_id`,`cron_timestamp`);--> statement-breakpoint
DROP INDEX IF EXISTS "page_slug_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_slug_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_stripe_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_id_dsn_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "user_tenant_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "notification_id_monitor_id_crontimestampe";--> statement-breakpoint
DROP INDEX IF EXISTS "monitor_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "incident_monitor_id_started_at_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "application_dsn_unique";--> statement-breakpoint
ALTER TABLE `status_report_update` ALTER COLUMN "status" TO "status" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `page_slug_unique` ON `page` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_slug_unique` ON `workspace` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_stripe_id_unique` ON `workspace` (`stripe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_id_dsn_unique` ON `workspace` (`id`,`dsn`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_tenant_id_unique` ON `user` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `monitor_status_idx` ON `monitor_status` (`monitor_id`,`region`);--> statement-breakpoint
CREATE UNIQUE INDEX `incident_monitor_id_started_at_unique` ON `incident` (`monitor_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_dsn_unique` ON `application` (`dsn`);