PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_status_report` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`title` text(256) NOT NULL,
	`workspace_id` integer,
	`page_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_status_report`("id", "status", "title", "workspace_id", "page_id", "created_at", "updated_at") SELECT "id", "status", "title", "workspace_id", "page_id", "created_at", "updated_at" FROM `status_report`;--> statement-breakpoint
DROP TABLE `status_report`;--> statement-breakpoint
ALTER TABLE `__new_status_report` RENAME TO `status_report`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_notification_trigger` (
	`id` integer PRIMARY KEY NOT NULL,
	`monitor_id` integer,
	`notification_id` integer,
	`cron_timestamp` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notification_id`) REFERENCES `notification`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_notification_trigger`("id", "monitor_id", "notification_id", "cron_timestamp") SELECT "id", "monitor_id", "notification_id", "cron_timestamp" FROM `notification_trigger`;--> statement-breakpoint
DROP TABLE `notification_trigger`;--> statement-breakpoint
ALTER TABLE `__new_notification_trigger` RENAME TO `notification_trigger`;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_id_monitor_id_crontimestampe` ON `notification_trigger` (`notification_id`,`monitor_id`,`cron_timestamp`);--> statement-breakpoint
CREATE TABLE `__new_maintenance` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text(256) NOT NULL,
	`message` text NOT NULL,
	`from` integer NOT NULL,
	`to` integer NOT NULL,
	`workspace_id` integer,
	`page_id` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_maintenance`("id", "title", "message", "from", "to", "workspace_id", "page_id", "created_at", "updated_at") SELECT "id", "title", "message", "from", "to", "workspace_id", "page_id", "created_at", "updated_at" FROM `maintenance`;--> statement-breakpoint
DROP TABLE `maintenance`;--> statement-breakpoint
ALTER TABLE `__new_maintenance` RENAME TO `maintenance`;