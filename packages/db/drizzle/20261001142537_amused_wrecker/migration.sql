ALTER TABLE `status_report` ADD `created_by` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `status_report` ADD `updated_by` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `status_report_update` ADD `created_by` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `status_report_update` ADD `updated_by` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `maintenance` ADD `created_by` integer REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `maintenance` ADD `updated_by` integer REFERENCES user(id);