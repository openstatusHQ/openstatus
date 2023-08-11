ALTER TABLE workspace ADD `subscription_id` text;--> statement-breakpoint
ALTER TABLE workspace ADD `plan` text(3) DEFAULT 'hobby';--> statement-breakpoint
ALTER TABLE workspace ADD `ends_at` integer;--> statement-breakpoint
ALTER TABLE workspace ADD `paid_until` integer;