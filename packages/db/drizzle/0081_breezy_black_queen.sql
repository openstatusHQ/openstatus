ALTER TABLE `monitor` ADD `proxy_url` text(2048);--> statement-breakpoint
ALTER TABLE `monitor` ADD `proxy_region` text(256);--> statement-breakpoint
ALTER TABLE `monitor` ADD `proxy_headers` text;