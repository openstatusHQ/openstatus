CREATE TABLE `checker_outbox` (
	`id` integer PRIMARY KEY NOT NULL,
	`dedup_key` text NOT NULL,
	`monitor_id` integer NOT NULL,
	`workspace_id` integer,
	`notification_id` integer NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`cron_timestamp` integer NOT NULL,
	`incident_id` integer,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` integer NOT NULL,
	`deadline_at` integer NOT NULL,
	`locked_by` text,
	`locked_until` integer,
	`delivered_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`notification_id`) REFERENCES `notification`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checker_outbox_dedup_key_idx` ON `checker_outbox` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `checker_outbox_claim_idx` ON `checker_outbox` (`available_at`) WHERE "checker_outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `checker_outbox_notification_id_cron_timestamp_idx` ON `checker_outbox` (`notification_id`,`cron_timestamp`);--> statement-breakpoint
CREATE INDEX `checker_outbox_channel_idx` ON `checker_outbox` (`monitor_id`,`notification_id`) WHERE "checker_outbox"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `notification_dead_letter` (
	`id` integer PRIMARY KEY NOT NULL,
	`outbox_id` integer NOT NULL,
	`dedup_key` text NOT NULL,
	`monitor_id` integer NOT NULL,
	`workspace_id` integer,
	`notification_id` integer NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`cron_timestamp` integer NOT NULL,
	`incident_id` integer,
	`payload` text NOT NULL,
	`attempts` integer NOT NULL,
	`final_error` text,
	`died_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_dead_letter_dedup_key_idx` ON `notification_dead_letter` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `notification_dead_letter_workspace_id_died_at_idx` ON `notification_dead_letter` (`workspace_id`,`died_at`);--> statement-breakpoint
CREATE TABLE `checker_decision` (
	`id` integer PRIMARY KEY NOT NULL,
	`monitor_id` integer NOT NULL,
	`region` text NOT NULL,
	`cron_timestamp` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`quorum_count` integer NOT NULL,
	`region_count` integer NOT NULL,
	`transitioned` integer NOT NULL,
	`outbox_rows` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checker_decision_monitor_id_cron_timestamp_idx` ON `checker_decision` (`monitor_id`,`cron_timestamp`);--> statement-breakpoint
CREATE INDEX `checker_decision_created_at_idx` ON `checker_decision` (`created_at`);--> statement-breakpoint
DROP INDEX `incident_open_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `incident_open_idx` ON `incident` (`monitor_id`) WHERE "incident"."resolved_at" IS NULL;--> statement-breakpoint
ALTER TABLE `monitor_status` ADD `cron_timestamp` integer DEFAULT 0 NOT NULL;