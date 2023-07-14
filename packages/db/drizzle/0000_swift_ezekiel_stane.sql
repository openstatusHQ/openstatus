CREATE TABLE `incident` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text(2) NOT NULL,
	`page_id` integer NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `incidentUpdate` (
	`id` integer PRIMARY KEY NOT NULL,
	`incident_date` integer,
	`title` text(256),
	`message` text,
	`incident_id` integer NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`icon` text(256),
	`slug` text(256) NOT NULL,
	`custom_domain` text(256) DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `monitor` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_type` text(3) DEFAULT 'other' NOT NULL,
	`periodicity` text(6) DEFAULT 'other' NOT NULL,
	`status` text(2) DEFAULT 'inactive' NOT NULL,
	`url` text(512) NOT NULL,
	`name` text(256) DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`page_id` integer,
	`workspace_id` integer,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY NOT NULL,
	`tenant_id` text(256),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `users_to_workspaces` (
	`user_id` integer NOT NULL,
	`workspace_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `workspace_id`)
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` integer PRIMARY KEY NOT NULL,
	`stripe_id` text(256),
	`name` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
