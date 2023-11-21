CREATE TABLE `monitor_status` (
	`monitor_id` integer NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`monitor_id`, `region`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_status_idx` ON `monitor_status` (`monitor_id`,`region`);