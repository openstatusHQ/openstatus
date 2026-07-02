CREATE TABLE `maintenance_to_page_component` (
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
	FOREIGN KEY (`group_id`) REFERENCES `page_component_groups`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "page_component_type_check" CHECK("page_component"."type" = 'monitor' AND "page_component"."monitor_id" IS NOT NULL OR "page_component"."type" = 'external' AND "page_component"."monitor_id" IS NULL)
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
CREATE TABLE `page_component_groups` (
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
-- Data Migration: monitors_to_pages → page_component
-- This section migrates data from the old structure to the new page_component structure
-- Step 0: Migrate monitor_group to page_component_groups
INSERT OR IGNORE INTO `page_component_groups` (
	`id`,
	`workspace_id`,
	`page_id`,
	`name`,
	`created_at`,
	`updated_at`
)
SELECT 
	mg.id,
	mg.workspace_id,
	mg.page_id,
	mg.name,
	mg.created_at,
	mg.updated_at
FROM `monitor_group` mg;
--> statement-breakpoint
-- Step 1: Migrate monitors_to_pages to page_component
INSERT OR IGNORE INTO `page_component` (
	`workspace_id`,
	`page_id`,
	`type`,
	`monitor_id`,
	`name`,
	`order`,
	`group_id`,
	`group_order`,
	`created_at`,
	`updated_at`
)
SELECT 
	m.workspace_id,
	mtp.page_id,
	'monitor' as type,
	mtp.monitor_id,
	COALESCE(m.external_name, m.name, 'Unnamed Monitor') as name,
	COALESCE(mtp.`order`, 0),
	mtp.monitor_group_id as group_id,
	COALESCE(mtp.group_order, 0) as group_order,
	mtp.created_at,
	strftime('%s', 'now') as updated_at
FROM `monitors_to_pages` mtp
INNER JOIN `monitor` m ON mtp.monitor_id = m.id
WHERE m.workspace_id IS NOT NULL;
--> statement-breakpoint
-- Step 2: Migrate status_report_to_monitors to status_report_to_page_component
INSERT OR IGNORE INTO `status_report_to_page_component` (
	`status_report_id`,
	`page_component_id`,
	`created_at`
)
SELECT DISTINCT
	srtm.status_report_id,
	pc.id as page_component_id,
	srtm.created_at
FROM `status_report_to_monitors` srtm
INNER JOIN `status_report` sr ON srtm.status_report_id = sr.id
INNER JOIN `page_component` pc ON srtm.monitor_id = pc.monitor_id
WHERE (sr.page_id = pc.page_id OR sr.page_id IS NULL);
--> statement-breakpoint
-- Step 3: Migrate maintenance_to_monitor to maintenance_to_page_component
INSERT OR IGNORE INTO `maintenance_to_page_component` (
	`maintenance_id`,
	`page_component_id`,
	`created_at`
)
SELECT DISTINCT
	mtm.maintenance_id,
	pc.id as page_component_id,
	mtm.created_at
FROM `maintenance_to_monitor` mtm
INNER JOIN `maintenance` m ON mtm.maintenance_id = m.id
INNER JOIN `page_component` pc ON mtm.monitor_id = pc.monitor_id
WHERE (m.page_id = pc.page_id OR m.page_id IS NULL);