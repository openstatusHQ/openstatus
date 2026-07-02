ALTER TABLE page RENAME COLUMN `updated_at` to `created_at` ;--> statement-breakpoint
ALTER TABLE page ADD `updated_at` integer;--> statement-breakpoint

ALTER TABLE monitor RENAME COLUMN `updated_at` to `created_at` ;--> statement-breakpoint
ALTER TABLE monitor ADD `updated_at` integer;--> statement-breakpoint

ALTER TABLE user RENAME COLUMN `updated_at` to `created_at` ;--> statement-breakpoint
ALTER TABLE user ADD `updated_at` integer;--> statement-breakpoint

ALTER TABLE workspace RENAME COLUMN `updated_at` to `created_at` ;--> statement-breakpoint
ALTER TABLE workspace ADD `updated_at` integer;