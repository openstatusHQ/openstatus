CREATE TABLE `uptime_target_excused_window` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`uptime_target_id` integer NOT NULL,
	`kind` text NOT NULL,
	`reason` text NOT NULL,
	`from` integer NOT NULL,
	`to` integer NOT NULL,
	`monitor_maintenance_window_id` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uptime_target_id`) REFERENCES `uptime_target`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_maintenance_window_id`) REFERENCES `monitor_maintenance_window`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `uptime_target_excused_window_target_id_idx` ON `uptime_target_excused_window` (`uptime_target_id`);--> statement-breakpoint
CREATE TABLE `uptime_target_excused_window_to_monitor` (
	`uptime_target_excused_window_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	PRIMARY KEY(`uptime_target_excused_window_id`, `monitor_id`),
	FOREIGN KEY (`uptime_target_excused_window_id`) REFERENCES `uptime_target_excused_window`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uptime_target_excused_window_to_monitor_monitor_id_idx` ON `uptime_target_excused_window_to_monitor` (`monitor_id`);--> statement-breakpoint
CREATE TABLE `uptime_target_miss_notice` (
	`uptime_target_id` integer NOT NULL,
	`workspace_id` integer NOT NULL,
	`month` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	PRIMARY KEY(`uptime_target_id`, `month`),
	FOREIGN KEY (`uptime_target_id`) REFERENCES `uptime_target`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `uptime_target` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`name` text NOT NULL,
	`target` integer NOT NULL,
	`strict` integer DEFAULT false NOT NULL,
	`time_zone` text DEFAULT 'UTC' NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uptime_target_workspace_id_idx` ON `uptime_target` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `uptime_target_to_monitor` (
	`uptime_target_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	PRIMARY KEY(`uptime_target_id`, `monitor_id`),
	FOREIGN KEY (`uptime_target_id`) REFERENCES `uptime_target`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uptime_target_to_monitor_monitor_id_idx` ON `uptime_target_to_monitor` (`monitor_id`);--> statement-breakpoint
CREATE TABLE `uptime_target_sealed_month` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`uptime_target_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	`month` text NOT NULL,
	`time_zone` text DEFAULT 'UTC' NOT NULL,
	`target` integer NOT NULL,
	`strict` integer NOT NULL,
	`excused_windows` text DEFAULT '[]' NOT NULL,
	`uptime` integer,
	`met` integer,
	`measured_ms` integer NOT NULL,
	`down_ms` integer NOT NULL,
	`excused_ms` integer NOT NULL,
	`unmeasured_ms` integer NOT NULL,
	`coverage` integer,
	`sealed_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uptime_target_id`) REFERENCES `uptime_target`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uptime_target_sealed_month_workspace_id_idx` ON `uptime_target_sealed_month` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `uptime_target_sealed_month_monitor_id_idx` ON `uptime_target_sealed_month` (`monitor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uptime_target_sealed_month_target_monitor_month_unique` ON `uptime_target_sealed_month` (`uptime_target_id`,`monitor_id`,`month`);--> statement-breakpoint
CREATE TABLE `monitor_uptime_episode` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	`kind` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_uptime_episode_monitor_id_started_at_idx` ON `monitor_uptime_episode` (`monitor_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `monitor_uptime_watermark` (
	`monitor_id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`sealed_from` integer NOT NULL,
	`sealed_until` integer NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `incident_response_target` (
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
CREATE UNIQUE INDEX `incident_response_target_workspace_id_idx` ON `incident_response_target` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `incident_target_notice` (
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
CREATE UNIQUE INDEX `incident_target_notice_unique_idx` ON `incident_target_notice` (`incident_id`,`kind`,`notice`,`due_at`,`channel`);--> statement-breakpoint
INSERT INTO `uptime_target` (`id`, `workspace_id`, `name`, `target`, `strict`, `time_zone`, `archived_at`, `created_at`, `updated_at`) SELECT `id`, `workspace_id`, `name`, `target`, `strict`, `time_zone`, `archived_at`, `created_at`, `updated_at` FROM `monitor_sla_policy`;--> statement-breakpoint
INSERT INTO `uptime_target_to_monitor` (`uptime_target_id`, `monitor_id`, `created_at`) SELECT `monitor_sla_policy_id`, `monitor_id`, `created_at` FROM `monitor_sla_policy_to_monitor`;--> statement-breakpoint
INSERT INTO `uptime_target_excused_window` (`id`, `workspace_id`, `uptime_target_id`, `kind`, `reason`, `from`, `to`, `monitor_maintenance_window_id`, `created_by`, `created_at`) SELECT `id`, `workspace_id`, `monitor_sla_policy_id`, `kind`, `reason`, `from`, `to`, `monitor_maintenance_window_id`, `created_by`, `created_at` FROM `monitor_sla_excused_window`;--> statement-breakpoint
INSERT INTO `uptime_target_excused_window_to_monitor` (`uptime_target_excused_window_id`, `monitor_id`) SELECT `monitor_sla_excused_window_id`, `monitor_id` FROM `monitor_sla_excused_window_to_monitor`;--> statement-breakpoint
INSERT INTO `uptime_target_miss_notice` (`uptime_target_id`, `workspace_id`, `month`, `created_at`) SELECT `monitor_sla_policy_id`, `workspace_id`, `month`, `created_at` FROM `monitor_sla_miss_notice`;--> statement-breakpoint
INSERT INTO `uptime_target_sealed_month` (`id`, `workspace_id`, `uptime_target_id`, `monitor_id`, `month`, `time_zone`, `target`, `strict`, `excused_windows`, `uptime`, `met`, `measured_ms`, `down_ms`, `excused_ms`, `unmeasured_ms`, `coverage`, `sealed_at`) SELECT `id`, `workspace_id`, `monitor_sla_policy_id`, `monitor_id`, `month`, `time_zone`, `target`, `strict`, `excused_windows`, `uptime`, `met`, `measured_ms`, `down_ms`, coalesce(`excused_ms`, 0), coalesce(`unmeasured_ms`, 0), `coverage`, `sealed_at` FROM `monitor_sla_sealed_month` WHERE `measured_ms` IS NOT NULL AND `down_ms` IS NOT NULL;--> statement-breakpoint
INSERT INTO `incident_response_target` (`id`, `workspace_id`, `targets`, `resolution_stop`, `response_met`, `created_at`, `updated_at`) SELECT `id`, `workspace_id`, `targets`, `resolution_stop`, `response_met`, `created_at`, `updated_at` FROM `incident_sla_policy`;--> statement-breakpoint
INSERT INTO `incident_target_notice` (`id`, `incident_id`, `kind`, `notice`, `due_at`, `channel`, `created_at`) SELECT `id`, `incident_id`, `kind`, `notice`, `due_at`, `channel`, `created_at` FROM `incident_sla_notice`;--> statement-breakpoint
ALTER TABLE `incident` RENAME COLUMN `sla_snapshot` TO `target_snapshot`;--> statement-breakpoint
DROP INDEX `incident_event_system_unique_idx`;--> statement-breakpoint
UPDATE `incident_event` SET `type` = 'response_target_breached' WHERE `type` = 'sla_response_breached';--> statement-breakpoint
UPDATE `incident_event` SET `type` = 'resolution_target_breached' WHERE `type` = 'sla_resolution_breached';--> statement-breakpoint
CREATE UNIQUE INDEX `incident_event_system_unique_idx` ON `incident_event` (`incident_id`,`type`,`created_at`) WHERE "incident_event"."type" IN ('response_target_breached', 'resolution_target_breached');--> statement-breakpoint
UPDATE `audit_log` SET `entity_type` = 'uptime_target', `action` = replace(`action`, 'monitor_sla_policy.', 'uptime_target.') WHERE `entity_type` = 'monitor_sla_policy';--> statement-breakpoint
UPDATE `audit_log` SET `entity_type` = 'uptime_target_excused_window', `action` = replace(`action`, 'monitor_sla_excused_window.', 'uptime_target_excused_window.') WHERE `entity_type` = 'monitor_sla_excused_window';--> statement-breakpoint
UPDATE `audit_log` SET `entity_type` = 'incident_response_target', `action` = replace(`action`, 'incident_sla_policy.', 'incident_response_target.') WHERE `entity_type` = 'incident_sla_policy';--> statement-breakpoint
DROP TABLE `monitor_sla_sealed_episode`;--> statement-breakpoint
DROP TABLE `monitor_sla_sealed_month`;--> statement-breakpoint
DROP TABLE `monitor_sla_miss_notice`;--> statement-breakpoint
DROP TABLE `monitor_sla_excused_window_to_monitor`;--> statement-breakpoint
DROP TABLE `monitor_sla_excused_window`;--> statement-breakpoint
DROP TABLE `monitor_sla_policy_to_monitor`;--> statement-breakpoint
DROP TABLE `monitor_sla_policy`;--> statement-breakpoint
DROP TABLE `incident_sla_notice`;--> statement-breakpoint
DROP TABLE `incident_sla_policy`;