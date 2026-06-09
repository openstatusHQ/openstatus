CREATE TABLE `external_service_report` (
	`id` integer PRIMARY KEY NOT NULL,
	`external_service_id` integer NOT NULL,
	`external_service_component_id` integer,
	`reporter_hash` text NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`external_service_id`) REFERENCES `external_service`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`external_service_component_id`) REFERENCES `external_service_component`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `external_service_report_service_idx` ON `external_service_report` (`external_service_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `external_service_report_component_idx` ON `external_service_report` (`external_service_component_id`,`created_at`);