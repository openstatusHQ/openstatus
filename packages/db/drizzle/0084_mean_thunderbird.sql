CREATE TABLE `maintenance_update` (
	`id` integer PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`date` integer NOT NULL,
	`maintenance_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `maintenance_update_maintenance_id_idx` ON `maintenance_update` (`maintenance_id`);
--> statement-breakpoint
INSERT INTO `maintenance_update` (`message`, `date`, `maintenance_id`)
SELECT `message`, COALESCE(`created_at`, `from`), `id`
FROM `maintenance`;