CREATE TABLE `status_report_update_to_page_component` (
	`status_report_update_id` integer NOT NULL,
	`page_component_id` integer NOT NULL,
	`impact` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`status_report_update_id`, `page_component_id`),
	FOREIGN KEY (`status_report_update_id`) REFERENCES `status_report_update`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_component_id`) REFERENCES `page_component`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_report_update_to_page_component_page_component_id_idx` ON `status_report_update_to_page_component` (`page_component_id`);--> statement-breakpoint
CREATE TABLE `external_service_report` (
	`id` integer PRIMARY KEY NOT NULL,
	`external_service_id` integer NOT NULL,
	`external_service_component_id` integer,
	`reporter_hash` text(64) NOT NULL,
	`country` text(2) DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`external_service_id`) REFERENCES `external_service`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`external_service_component_id`) REFERENCES `external_service_component`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `external_service_report_service_idx` ON `external_service_report` (`external_service_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `external_service_report_component_idx` ON `external_service_report` (`external_service_component_id`,`created_at`);