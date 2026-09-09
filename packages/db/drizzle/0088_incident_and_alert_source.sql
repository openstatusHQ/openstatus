CREATE TABLE `alert_source` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`provider` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`config` text DEFAULT (json_object()) NOT NULL,
	`last_event_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_source_workspace_id_provider_idx` ON `alert_source` (`workspace_id`,`provider`);--> statement-breakpoint
CREATE TABLE `incident` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'triage' NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`origin` text NOT NULL,
	`fingerprint` text,
	`alert_source_id` integer,
	`status_report_id` integer,
	`started_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`acknowledged_at` integer,
	`acknowledged_by` integer,
	`resolved_at` integer,
	`resolved_by` integer,
	`auto_resolved` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`alert_source_id`) REFERENCES `alert_source`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`status_report_id`) REFERENCES `status_report`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `incident_workspace_id_started_at_idx` ON `incident` (`workspace_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `incident_open_fingerprint_idx` ON `incident` (`alert_source_id`,`fingerprint`) WHERE "incident"."resolved_at" IS NULL AND "incident"."fingerprint" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor_incident` ADD `incident_id` integer REFERENCES incident(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `notification_outbox` RENAME COLUMN `incident_id` TO `monitor_incident_id`;--> statement-breakpoint
ALTER TABLE `notification_dead_letter` RENAME COLUMN `incident_id` TO `monitor_incident_id`;
