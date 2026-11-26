DROP INDEX `incident_workspace_id_idx`;--> statement-breakpoint
CREATE INDEX `incident_workspace_id_started_at_idx` ON `incident` (`workspace_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `incident_open_idx` ON `incident` (`monitor_id`) WHERE "incident"."resolved_at" IS NULL;--> statement-breakpoint
DROP INDEX `monitor_run_workspace_id_idx`;--> statement-breakpoint
CREATE INDEX `monitor_run_workspace_id_created_at_idx` ON `monitor_run` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `page_subscriber_page_id_idx` ON `page_subscriber` (`page_id`);