CREATE TABLE `incident` (
	`id` serial AUTO_INCREMENT,
	`status` enum('resolved','investigatin',''),
	`created_at` datetime DEFAULT '2023-06-24 19:14:15.944',
	`update_at` datetime);
--> statement-breakpoint
CREATE TABLE `incidentUpdate` (
	`id` serial AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`incident_date` datetime,
	`title` varchar(256),
	`message` text,
	`updated_at` datetime);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` serial AUTO_INCREMENT,
	`slug` varchar(256),
	`custom_domain` varchar(256),
	`created_at` datetime DEFAULT '2023-06-24 19:14:15.948',
	`updated_at` datetime);
--> statement-breakpoint
CREATE TABLE `statusJob` (
	`id` serial AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`job_type` enum('website','cron','other') NOT NULL DEFAULT 'other',
	`periodicity` enum('every-5-min','every-1-min','every-1-h','other') NOT NULL DEFAULT 'other',
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`url` varchar(512),
	`created_at` datetime DEFAULT '2023-06-24 19:14:15.948',
	`updated_at` datetime);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` serial AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`tenant_id` varchar(256),
	`created_at` datetime DEFAULT '2023-06-24 19:14:15.949',
	`update_at` datetime);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` serial AUTO_INCREMENT,
	`stripe_id` varchar(256),
	`created_at` datetime DEFAULT '2023-06-24 19:14:15.951',
	`update_at` datetime);
--> statement-breakpoint
ALTER TABLE `incident` ADD CONSTRAINT `incident_id_incidentUpdate_id_fk` FOREIGN KEY (`id`) REFERENCES `incidentUpdate`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page` ADD CONSTRAINT `page_id_statusJob_id_fk` FOREIGN KEY (`id`) REFERENCES `statusJob`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page` ADD CONSTRAINT `page_id_incident_id_fk` FOREIGN KEY (`id`) REFERENCES `incident`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspace` ADD CONSTRAINT `workspace_id_user_id_fk` FOREIGN KEY (`id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspace` ADD CONSTRAINT `workspace_id_page_id_fk` FOREIGN KEY (`id`) REFERENCES `page`(`id`) ON DELETE no action ON UPDATE no action;