ALTER TABLE `status_report` ADD `page_id` integer REFERENCES page(id);--> statement-breakpoint

UPDATE `status_report` SET `page_id` = `t`.`page_id` from (select `page_id`, `status_report_id` from `status_reports_to_pages`) `t` where `t`.`status_report_id` = `id` ;