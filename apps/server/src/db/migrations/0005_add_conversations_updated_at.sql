CREATE TABLE `__new_conversations` (
	`connection_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`feature` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_conversations` (
	`connection_id`,
	`created_at`,
	`feature`,
	`id`,
	`title`,
	`updated_at`,
	`user_id`
)
SELECT
	`connection_id`,
	`created_at`,
	`feature`,
	`id`,
	`title`,
	`created_at`,
	`user_id`
FROM `conversations`;
--> statement-breakpoint
DROP TABLE `conversations`;
--> statement-breakpoint
ALTER TABLE `__new_conversations` RENAME TO `conversations`;
--> statement-breakpoint
CREATE INDEX `conversations_user_feature_created_idx`
	ON `conversations` (`user_id`, `feature`, `created_at`);
