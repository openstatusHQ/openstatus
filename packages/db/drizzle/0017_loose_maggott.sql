ALTER TABLE status_report_to_monitors ADD `created_at`;--> statement-breakpoint
ALTER TABLE status_report_to_monitors ALTER COLUMN  `created_at` to `created_at` integer DEFAULT (strftime('%s', 'now'));--> statement-breakpoint

ALTER TABLE status_reports_to_pages ADD `created_at`;--> statement-breakpoint
ALTER TABLE status_reports_to_pages ALTER COLUMN  `created_at` to `created_at` integer DEFAULT (strftime('%s', 'now'));--> statement-breakpoint

ALTER TABLE monitors_to_pages ADD `created_at`;--> statement-breakpoint
ALTER TABLE monitors_to_pages ALTER COLUMN  `created_at` to `created_at` integer DEFAULT (strftime('%s', 'now'));--> statement-breakpoint

ALTER TABLE users_to_workspaces ADD `created_at`;--> statement-breakpoint
ALTER TABLE users_to_workspaces ALTER COLUMN  `created_at` to `created_at` integer DEFAULT (strftime('%s', 'now'));--> statement-breakpoint

ALTER TABLE notifications_to_monitors ADD `created_at`;--> statement-breakpoint
ALTER TABLE notifications_to_monitors ALTER COLUMN  `created_at` to `created_at` integer DEFAULT (strftime('%s', 'now'));
