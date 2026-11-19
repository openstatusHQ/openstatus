CREATE TABLE `monitor_maintenance_window` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`title` text(256) NOT NULL,
	`mode` text DEFAULT 'pause' NOT NULL,
	`from` integer NOT NULL,
	`to` integer NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `monitor_maintenance_window_workspace_id_idx` ON `monitor_maintenance_window` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `monitor_maintenance_window_to_idx` ON `monitor_maintenance_window` (`to`);--> statement-breakpoint
CREATE TABLE `monitor_maintenance_window_to_monitor` (
	`monitor_maintenance_window_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	PRIMARY KEY(`monitor_maintenance_window_id`, `monitor_id`),
	FOREIGN KEY (`monitor_maintenance_window_id`) REFERENCES `monitor_maintenance_window`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_maintenance_window_to_monitor_monitor_id_idx` ON `monitor_maintenance_window_to_monitor` (`monitor_id`);--> statement-breakpoint
ALTER TABLE `monitor_incident` ADD `excused_at` integer;--> statement-breakpoint
ALTER TABLE `monitor_incident` ADD `excused_by` integer REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `monitor_incident` ADD `excused_reason` text;--> statement-breakpoint
ALTER TABLE `frozen_monitor_uptime` ADD `bucket_minutes` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `acknowledged_at` integer;--> statement-breakpoint
ALTER TABLE `incident` ADD `acknowledged_by` integer REFERENCES user(id);