/*
 SQLite does not support "Dropping foreign key" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/

ALTER TABLE `monitor` RENAME TO `monitor_old`;
--> statement-breakpoint

CREATE TABLE `monitor` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_type` text(3) DEFAULT 'other' NOT NULL,
	`periodicity` text(6) DEFAULT 'other' NOT NULL,
	`status` text(2) DEFAULT 'inactive' NOT NULL,
	`active` integer DEFAULT false,
	`url` text(512) NOT NULL,
	`name` text(256) DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`workspace_id` integer,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `monitor` SELECT `id`,`job_type`,`periodicity`,`status`,`active`,`url`,`name`,`description`,`workspace_id`,`updated_at` FROM `monitor_old`;
--> statement-breakpoint

ALTER TABLE `monitors_to_pages` RENAME TO `monitors_to_pages_old`;
--> statement-breakpoint

CREATE TABLE `monitors_to_pages` (
	`monitor_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	PRIMARY KEY(`monitor_id`, `page_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `monitors_to_pages` SELECT * FROM `monitors_to_pages_old`;


--> statement-breakpoint
DROP TABLE `monitor_old`;
--> statement-breakpoint

DROP TABLE `monitors_to_pages_old`;
