ALTER TABLE `incidents_to_monitors` RENAME TO `status_report_to_monitors`;--> statement-breakpoint
ALTER TABLE `incidents_to_pages` RENAME TO `status_reports_to_pages`;--> statement-breakpoint
ALTER TABLE `incident_update` RENAME TO `status_report_update`;--> statement-breakpoint
ALTER TABLE `incident` RENAME TO `status_report`; --> statement-breakpoint
ALTER TABLE `status_report_to_monitors` RENAME COLUMN `incident_id` TO `status_report_id`;--> statement-breakpoint
ALTER TABLE `status_reports_to_pages` RENAME COLUMN `incident_id` TO `status_report_id`;--> statement-breakpoint
ALTER TABLE `status_report_update` RENAME COLUMN `incident_id` TO `status_report_id`;