CREATE TABLE `conversations` (
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`feature` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversations_user_feature_created_idx` ON `conversations` (`user_id`,`feature`,`created_at`);