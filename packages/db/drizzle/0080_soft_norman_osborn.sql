CREATE TABLE `private_location_monitor_status` (
	`monitor_id` integer NOT NULL,
	`private_location_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`cron_timestamp` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`monitor_id`, `private_location_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`private_location_id`) REFERENCES `private_location`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `private_location_monitor_status_pl_id_idx` ON `private_location_monitor_status` (`private_location_id`);