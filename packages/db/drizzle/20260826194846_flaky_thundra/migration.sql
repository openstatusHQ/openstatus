ALTER TABLE `monitor` ADD `grpc_service` text;--> statement-breakpoint
ALTER TABLE `monitor` ADD `grpc_tls` text DEFAULT 'tls';