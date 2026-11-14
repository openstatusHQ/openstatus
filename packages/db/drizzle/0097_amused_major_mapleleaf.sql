CREATE TABLE `monitor_sla_excused_window` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`monitor_sla_policy_id` integer NOT NULL,
	`kind` text NOT NULL,
	`reason` text NOT NULL,
	`from` integer NOT NULL,
	`to` integer NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_sla_policy_id`) REFERENCES `monitor_sla_policy`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `monitor_sla_excused_window_policy_id_idx` ON `monitor_sla_excused_window` (`monitor_sla_policy_id`);--> statement-breakpoint
CREATE TABLE `monitor_sla_miss_notice` (
	`monitor_sla_policy_id` integer NOT NULL,
	`workspace_id` integer NOT NULL,
	`month` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	PRIMARY KEY(`monitor_sla_policy_id`, `month`),
	FOREIGN KEY (`monitor_sla_policy_id`) REFERENCES `monitor_sla_policy`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitor_sla_policy` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`name` text NOT NULL,
	`target` integer NOT NULL,
	`strict` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_sla_policy_workspace_id_idx` ON `monitor_sla_policy` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `monitor_sla_policy_to_monitor` (
	`monitor_sla_policy_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	PRIMARY KEY(`monitor_sla_policy_id`, `monitor_id`),
	FOREIGN KEY (`monitor_sla_policy_id`) REFERENCES `monitor_sla_policy`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_sla_policy_to_monitor_monitor_id_idx` ON `monitor_sla_policy_to_monitor` (`monitor_id`);--> statement-breakpoint
CREATE TABLE `monitor_sla_sealed_month` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`monitor_sla_policy_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	`month` text NOT NULL,
	`target` integer NOT NULL,
	`strict` integer NOT NULL,
	`ok` integer NOT NULL,
	`degraded` integer NOT NULL,
	`error` integer NOT NULL,
	`excused_ok` integer DEFAULT 0 NOT NULL,
	`excused_degraded` integer DEFAULT 0 NOT NULL,
	`excused_error` integer DEFAULT 0 NOT NULL,
	`excused_windows` text DEFAULT '[]' NOT NULL,
	`total` integer NOT NULL,
	`up` integer NOT NULL,
	`uptime` integer,
	`met` integer,
	`sealed_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_sla_policy_id`) REFERENCES `monitor_sla_policy`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_sla_sealed_month_workspace_id_idx` ON `monitor_sla_sealed_month` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `monitor_sla_sealed_month_monitor_id_idx` ON `monitor_sla_sealed_month` (`monitor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_sla_sealed_month_policy_monitor_month_unique` ON `monitor_sla_sealed_month` (`monitor_sla_policy_id`,`monitor_id`,`month`);--> statement-breakpoint
CREATE TABLE `incident_sla_policy` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`targets` text NOT NULL,
	`resolution_stop` text DEFAULT 'mitigated' NOT NULL,
	`response_met` text DEFAULT 'acknowledged' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incident_sla_policy_workspace_id_idx` ON `incident_sla_policy` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `incident_sla_notice` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` integer NOT NULL,
	`kind` text NOT NULL,
	`notice` text NOT NULL,
	`due_at` integer NOT NULL,
	`channel` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incident_sla_notice_unique_idx` ON `incident_sla_notice` (`incident_id`,`kind`,`notice`,`due_at`,`channel`);--> statement-breakpoint
ALTER TABLE `monitor` ADD `maintenance_mode` text DEFAULT 'pause' NOT NULL;--> statement-breakpoint
ALTER TABLE `incident` ADD `reported_at` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `acknowledged_at` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `acknowledged_by` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `incident` ADD `sla_snapshot` text;--> statement-breakpoint
ALTER TABLE `incident` ADD `response_met_at` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `response_breach_due_at` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `resolution_stopped_at` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `resolution_breach_due_at` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `response_miss_reason` text;--> statement-breakpoint
ALTER TABLE `incident` ADD `resolution_miss_reason` text;--> statement-breakpoint
CREATE UNIQUE INDEX `incident_event_system_unique_idx` ON `incident_event` (`incident_id`,`type`,`created_at`) WHERE "incident_event"."type" IN ('sla_response_breached', 'sla_resolution_breached', 'sla_update_missed');--> statement-breakpoint
UPDATE `incident` SET `acknowledged_at` = `declared_at`, `acknowledged_by` = `declared_by` WHERE `acknowledged_at` IS NULL;
