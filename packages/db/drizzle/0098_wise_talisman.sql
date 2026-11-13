CREATE TABLE `monitor_sla_policy_terms` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`monitor_sla_policy_id` integer NOT NULL,
	`target` integer NOT NULL,
	`strict` integer NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_sla_policy_id`) REFERENCES `monitor_sla_policy`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_sla_policy_terms_workspace_id_idx` ON `monitor_sla_policy_terms` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_sla_policy_terms_policy_effective_from_unique` ON `monitor_sla_policy_terms` (`monitor_sla_policy_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `monitor_sla_sealed_episode` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`sealed_month_id` integer NOT NULL,
	`kind` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`runs` integer NOT NULL,
	`weighted_ms` integer NOT NULL,
	`treatment` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sealed_month_id`) REFERENCES `monitor_sla_sealed_month`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_sla_sealed_episode_sealed_month_id_idx` ON `monitor_sla_sealed_episode` (`sealed_month_id`);--> statement-breakpoint
ALTER TABLE `monitor_sla_policy` ADD `time_zone` text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `method` text DEFAULT 'runs' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `time_zone` text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `measured_ms` integer;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `down_ms` integer;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `excused_ms` integer;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `unmeasured_ms` integer;--> statement-breakpoint
ALTER TABLE `monitor_sla_sealed_month` ADD `coverage` integer;