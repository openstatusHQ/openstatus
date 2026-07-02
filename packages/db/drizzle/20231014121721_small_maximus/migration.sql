CREATE TABLE `incidents_to_pages` (
	`page_id` integer NOT NULL,
	`incident_id` integer NOT NULL,
	PRIMARY KEY(`incident_id`, `page_id`),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE cascade
);
