/*
 SQLite does not support "Changing existing column type" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually

*/
PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `monitor_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_type` text(3) DEFAULT 'other' NOT NULL,
	`periodicity` text(6) DEFAULT 'other' NOT NULL,
	`status` text(2) DEFAULT 'inactive' NOT NULL,
	`active` integer DEFAULT false,
	`url` text(512) NOT NULL,
	`name` text(256) DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`workspace_id` integer,
	`headers` text DEFAULT '',
	`body` text DEFAULT '',
	`method` text(5) DEFAULT 'GET',
	`created_at` integer DEFAULT (strftime('%s', 'now')), `regions` text DEFAULT '' NOT NULL, `updated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO monitor_new(`id`,`job_type`,`periodicity`,`status`,`active`,`url`,`name`,`description`,`workspace_id`,`created_at`,`regions`,`updated_at`) SELECT * FROM monitor;
--> statement-breakpoint

CREATE TABLE `monitors_to_pages_new` (
	`monitor_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	PRIMARY KEY(`monitor_id`, `page_id`)
);
--> statement-breakpoint
INSERT INTO monitors_to_pages_new(`monitor_id`,`page_id`) SELECT * FROM monitors_to_pages;
--> statement-breakpoint

CREATE TABLE `incidents_to_monitors_new` (
	`monitor_id` integer NOT NULL,
	`incident_id` integer NOT NULL,
	PRIMARY KEY(`incident_id`, `monitor_id`)
);
--> statement-breakpoint
INSERT INTO incidents_to_monitors_new(`monitor_id`,`incident_id`) SELECT * FROM incidents_to_monitors;
--> statement-breakpoint
DROP TABLE monitor;
--> statement-breakpoint
ALTER TABLE monitor_new RENAME TO monitor;
--> statement-breakpoint
INSERT INTO monitors_to_pages(`monitor_id`,`page_id`) SELECT * FROM monitors_to_pages_new;
--> statement-breakpoint
INSERT INTO incidents_to_monitors(`monitor_id`,`incident_id`) SELECT * FROM incidents_to_monitors_new;
--> statement-breakpoint
DROP TABLE monitors_to_pages_new;
--> statement-breakpoint
DROP TABLE incidents_to_monitors_new;
