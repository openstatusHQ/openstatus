CREATE TABLE `incident` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`status` enum('resolved','investigatin',''),
	`incident_update_id` int,
	`created_at` datetime NOT NULL,
	`update_at` datetime NOT NULL);
--> statement-breakpoint
CREATE TABLE `incidentUpdate` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`incident_date` datetime,
	`title` varchar(256),
	`message` text,
	`updated_at` datetime NOT NULL);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`slug` varchar(256),
	`custom_domain` varchar(256),
	`status_job_id` int,
	`incident_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL);
--> statement-breakpoint
CREATE TABLE `statusJob` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`job_type` enum('website','cron','other') NOT NULL DEFAULT 'other',
	`periodicity` enum('every-5-min','every-1-min','every-1-h','other') NOT NULL DEFAULT 'other',
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`url` varchar(512),
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`tenant_id` varchar(256),
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`stripe_id` varchar(256),
	`user_id` int,
	`page_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL);
