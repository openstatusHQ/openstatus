ALTER TABLE `page` ADD `allow_index` integer DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE `page` SET `allow_index` = 0 WHERE `access_type` != 'public' OR `access_type` IS NULL;