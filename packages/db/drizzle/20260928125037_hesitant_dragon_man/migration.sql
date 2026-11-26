CREATE TABLE `incident` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`title` text(256) NOT NULL,
	`severity` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`summary` text,
	`commander_id` integer,
	`declared_by` integer,
	`declared_at` integer NOT NULL,
	`started_at` integer NOT NULL,
	`mitigated_at` integer,
	`resolved_at` integer,
	`resolved_by` integer,
	`closed_at` integer,
	`status_report_id` integer,
	`slack_team_id` text,
	`slack_channel_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commander_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`declared_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`status_report_id`) REFERENCES `status_report`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `incident_workspace_id_status_idx` ON `incident` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `incident_workspace_id_declared_at_idx` ON `incident` (`workspace_id`,`declared_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `incident_slack_channel_idx` ON `incident` (`slack_team_id`,`slack_channel_id`) WHERE "incident"."slack_channel_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `incident_status_report_id_idx` ON `incident` (`status_report_id`) WHERE "incident"."status_report_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `incident_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` integer NOT NULL,
	`type` text NOT NULL,
	`message` text,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incident`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `incident_event_incident_id_created_at_idx` ON `incident_event` (`incident_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `slack_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`slack_team_id` text NOT NULL,
	`slack_user_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `slack_user_user_id_idx` ON `slack_user` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `slack_user_workspace_id_slack_team_id_slack_user_id_unique` ON `slack_user` (`workspace_id`,`slack_team_id`,`slack_user_id`);