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
CREATE INDEX `status_report_update_to_page_component_page_component_id_idx` ON `status_report_update_to_page_component` (`page_component_id`);