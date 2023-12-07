CREATE TABLE `status_report_subscriber` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status_report_id` integer,
	`verification_token` text,
	`validated_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`status_report_id`) REFERENCES `status_report`(`id`) ON UPDATE no action ON DELETE no action
);
