CREATE TABLE `page_groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_component` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`type` text DEFAULT 'monitor' NOT NULL,
	`monitor_id` integer,
	`name` text NOT NULL,
	`description` text,
	`order` integer DEFAULT 0,
	`group_id` integer,
	`group_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `page_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_component_page_id_monitor_id_unique` ON `page_component` (`page_id`,`monitor_id`);--> statement-breakpoint
CREATE TABLE `status_report_to_page_component` (
	`status_report_id` integer NOT NULL,
	`page_component_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`status_report_id`, `page_component_id`),
	FOREIGN KEY (`status_report_id`) REFERENCES `status_report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_component_id`) REFERENCES `page_component`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `maintenance_to_page_component` (
	`maintenance_id` integer NOT NULL,
	`page_component_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`maintenance_id`, `page_component_id`),
	FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_component_id`) REFERENCES `page_component`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `monitor_group`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_monitors_to_pages` (
	`monitor_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`order` integer DEFAULT 0,
	`monitor_group_id` integer,
	`group_order` integer DEFAULT 0,
	PRIMARY KEY(`monitor_id`, `page_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_group_id`) REFERENCES `page_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_monitors_to_pages`("monitor_id", "page_id", "created_at", "order", "monitor_group_id", "group_order") SELECT "monitor_id", "page_id", "created_at", "order", "monitor_group_id", "group_order" FROM `monitors_to_pages`;--> statement-breakpoint
DROP TABLE `monitors_to_pages`;--> statement-breakpoint
ALTER TABLE `__new_monitors_to_pages` RENAME TO `monitors_to_pages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;