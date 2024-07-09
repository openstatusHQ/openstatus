--  Let's remove it later
-- DROP TABLE `status_report_to_monitors`;
-- DROP TABLE `status_reports_to_pages`;
ALTER TABLE `status_report` ADD `page_id` integer REFERENCES page(id);--> statement-breakpoint
--  Let's first update the status report with a page associated
UPDATE `status_report` SET `page_id` = `t`.`page_id` from  (select `page_id`, `status_report_id` from `status_reports_to_pages`) `t` where `t`.`status_report_id` = `id` ;--> statement-breakpoint
-- Let's update the status report with the monitor associated

UPDATE `status_report` SET `page_id` = `t`.`page_id` from  (select `page_id`, `status_report_id` from `status_report_to_monitors`,`monitors_to_pages` where `status_report_to_monitors`.`monitor_id`=`monitors_to_pages`.`monitor_id`) `t` where `t`.`status_report_id` = `id`  and `status_report`.`page_id` is null;