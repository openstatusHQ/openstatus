/*
 SQLite does not support "Set autoincrement to a column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/


CREATE TABLE `monitorNEW` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_type` text DEFAULT 'other' NOT NULL,
	`periodicity` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`active` integer DEFAULT false,
	`regions` text DEFAULT '' NOT NULL,
	`url` text(2048) NOT NULL,
	`name` text(256) DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`headers` text DEFAULT '',
	`body` text DEFAULT '',
	`method` text DEFAULT 'GET',
	`workspace_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint


INSERT INTO monitorNEW (id, job_type, periodicity, status, active, regions, url, name, description, headers, body, method, workspace_id, created_at, updated_at) SELECT * FROM monitor; --> statement-breakpoint

DROP TABLE monitor;
--> statement-breakpoint
ALTER TABLE monitorNEW RENAME TO monitor;