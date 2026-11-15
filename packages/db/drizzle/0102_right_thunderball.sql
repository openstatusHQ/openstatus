ALTER TABLE `maintenance` ADD `monitor_maintenance_window_id` integer REFERENCES monitor_maintenance_window(id);--> statement-breakpoint
ALTER TABLE `maintenance` DROP COLUMN `mode`;