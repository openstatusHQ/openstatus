ALTER TABLE `workspace` ADD `trialed_at` integer;--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);