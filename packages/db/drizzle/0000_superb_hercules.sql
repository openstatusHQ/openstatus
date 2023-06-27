CREATE TABLE `incident` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`status` enum('resolved','investigatin',''),
	`page_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `incidentUpdate` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`incident_date` datetime,
	`title` varchar(256),
	`message` text,
	`incident_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`workspace_id` int NOT NULL,
	`slug` varchar(256),
	`custom_domain` varchar(256),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `monitor` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`job_type` enum('website','cron','other') NOT NULL DEFAULT 'other',
	`periodicity` enum('1m','5m','10m','30m','1h','other') NOT NULL DEFAULT 'other',
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`url` varchar(512),
	`page_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`tenant_id` varchar(256),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`stripe_id` varchar(256),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP);
