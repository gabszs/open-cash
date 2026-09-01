CREATE TABLE `agent_capability_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`capability` text NOT NULL,
	`denied_by` text,
	`granted_by` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`reason` text,
	`constraints` text,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`denied_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agentCapabilityGrants_agentId_idx` ON `agent_capability_grants` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agentCapabilityGrants_capability_idx` ON `agent_capability_grants` (`capability`);--> statement-breakpoint
CREATE INDEX `agentCapabilityGrants_grantedBy_idx` ON `agent_capability_grants` (`granted_by`);--> statement-breakpoint
CREATE INDEX `agentCapabilityGrants_status_idx` ON `agent_capability_grants` (`status`);--> statement-breakpoint
CREATE TABLE `agent_hosts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`user_id` text,
	`default_capabilities` text,
	`public_key` text,
	`kid` text,
	`jwks_url` text,
	`enrollment_token_hash` text,
	`enrollment_token_expires_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`activated_at` integer,
	`expires_at` integer,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agentHosts_userId_idx` ON `agent_hosts` (`user_id`);--> statement-breakpoint
CREATE INDEX `agentHosts_kid_idx` ON `agent_hosts` (`kid`);--> statement-breakpoint
CREATE INDEX `agentHosts_enrollmentTokenHash_idx` ON `agent_hosts` (`enrollment_token_hash`);--> statement-breakpoint
CREATE INDEX `agentHosts_status_idx` ON `agent_hosts` (`status`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`host_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`mode` text DEFAULT 'delegated' NOT NULL,
	`public_key` text NOT NULL,
	`kid` text,
	`jwks_url` text,
	`last_used_at` integer,
	`activated_at` integer,
	`expires_at` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`host_id`) REFERENCES `agent_hosts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agents_userId_idx` ON `agents` (`user_id`);--> statement-breakpoint
CREATE INDEX `agents_hostId_idx` ON `agents` (`host_id`);--> statement-breakpoint
CREATE INDEX `agents_status_idx` ON `agents` (`status`);--> statement-breakpoint
CREATE INDEX `agents_kid_idx` ON `agents` (`kid`);--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`agent_id` text,
	`host_id` text,
	`user_id` text,
	`capabilities` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`user_code_hash` text,
	`login_hint` text,
	`binding_message` text,
	`client_notification_token` text,
	`client_notification_endpoint` text,
	`delivery_mode` text,
	`interval` integer NOT NULL,
	`last_polled_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`host_id`) REFERENCES `agent_hosts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `approvalRequests_agentId_idx` ON `approval_requests` (`agent_id`);--> statement-breakpoint
CREATE INDEX `approvalRequests_hostId_idx` ON `approval_requests` (`host_id`);--> statement-breakpoint
CREATE INDEX `approvalRequests_userId_idx` ON `approval_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `approvalRequests_status_idx` ON `approval_requests` (`status`);