CREATE TABLE `maintenances_to_page_components` (
	`maintenance_id` integer NOT NULL,
	`page_component_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`maintenance_id`, `page_component_id`),
	FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_component_id`) REFERENCES `page_component`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_component` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`type` text NOT NULL,
	`monitor_id` integer,
	`name` text(256) NOT NULL,
	`description` text,
	`order` integer DEFAULT 0,
	`monitor_group_id` integer,
	`group_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_group_id`) REFERENCES `monitor_group`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "monitor_required_for_monitor_type" CHECK("page_component"."type" != 'monitor' OR "page_component"."monitor_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `status_reports_to_page_components` (
	`status_report_id` integer NOT NULL,
	`page_component_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`status_report_id`, `page_component_id`),
	FOREIGN KEY (`status_report_id`) REFERENCES `status_report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_component_id`) REFERENCES `page_component`(`id`) ON UPDATE no action ON DELETE cascade
);
