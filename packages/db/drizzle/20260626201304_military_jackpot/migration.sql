CREATE TABLE `frozen_monitor_uptime` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`monitor_id` integer NOT NULL,
	`month` text NOT NULL,
	`days` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `frozen_monitor_uptime_workspace_id_idx` ON `frozen_monitor_uptime` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `frozen_monitor_uptime_monitor_id_month_unique` ON `frozen_monitor_uptime` (`monitor_id`,`month`);