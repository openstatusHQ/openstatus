CREATE TABLE `maintenance_update` (
	`id` integer PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`date` integer NOT NULL,
	`maintenance_id` integer NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `maintenance_update_maintenance_id_idx` ON `maintenance_update` (`maintenance_id`);
--> statement-breakpoint
INSERT INTO `maintenance_update` (`maintenance_id`, `message`, `date`, `created_by`, `updated_by`)
SELECT `id`, `message`, COALESCE(`created_at`, `from`), `created_by`, `created_by`
FROM `maintenance`
WHERE `message` <> '';
