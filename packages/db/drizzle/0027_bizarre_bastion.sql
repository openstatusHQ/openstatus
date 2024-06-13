ALTER TABLE page ADD `password` text(256);--> statement-breakpoint
ALTER TABLE page ADD `password_protected` integer DEFAULT false;