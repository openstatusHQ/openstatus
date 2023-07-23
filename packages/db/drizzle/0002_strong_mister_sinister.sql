CREATE TABLE `monitors_to_pages` (
	`monitor_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	PRIMARY KEY(`monitor_id`, `page_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
