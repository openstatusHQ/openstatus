PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_private_location_to_monitor` (
	`private_location_id` integer,
	`monitor_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`deleted_at` integer,
	FOREIGN KEY (`private_location_id`) REFERENCES `private_location`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_private_location_to_monitor`("private_location_id", "monitor_id", "created_at", "deleted_at") SELECT "private_location_id", "monitor_id", "created_at", "deleted_at" FROM `private_location_to_monitor`;--> statement-breakpoint
DROP TABLE `private_location_to_monitor`;--> statement-breakpoint
ALTER TABLE `__new_private_location_to_monitor` RENAME TO `private_location_to_monitor`;--> statement-breakpoint
PRAGMA foreign_keys=ON;