ALTER TABLE `page` ADD `default_locale` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `page` ADD `locales` text;