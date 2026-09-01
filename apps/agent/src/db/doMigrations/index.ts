export const identityMigrations = {
	journal: {
		version: "7",
		dialect: "sqlite",
		entries: [
			{
				idx: 0,
				version: "7",
				when: 1_786_848_000_000,
				tag: "0000_identity",
				breakpoints: true,
			},
		],
	},
	migrations: {
		m0000: `CREATE TABLE IF NOT EXISTS "host_identity" (
"user_id" text PRIMARY KEY NOT NULL,
"host_id" text,
"public_key" text NOT NULL,
"private_key" text NOT NULL,
"key_version" integer DEFAULT 1 NOT NULL,
"status" text DEFAULT 'pending' NOT NULL,
"default_capabilities" text NOT NULL,
"created_at" integer DEFAULT (unixepoch()) NOT NULL,
"updated_at" integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_identity" (
"conversation_id" text PRIMARY KEY NOT NULL,
"agent_id" text UNIQUE,
"host_id" text NOT NULL,
"public_key" text NOT NULL,
"private_key" text NOT NULL,
"status" text DEFAULT 'pending' NOT NULL,
"capabilities" text NOT NULL,
"created_at" integer DEFAULT (unixepoch()) NOT NULL,
"updated_at" integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_identity_host_id_idx" ON "agent_identity" ("host_id");`,
	},
};
