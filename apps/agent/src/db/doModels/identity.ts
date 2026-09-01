import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
};

export const hostIdentity = sqliteTable("host_identity", {
	userId: text("user_id").primaryKey(),
	hostId: text("host_id"),
	publicKey: text("public_key").notNull(),
	privateKey: text("private_key").notNull(),
	keyVersion: integer("key_version").notNull().default(1),
	status: text("status", { enum: ["pending", "active", "revoked"] })
		.notNull()
		.default("pending"),
	defaultCapabilities: text("default_capabilities").notNull(),
	...timestamps,
});

export const agentIdentity = sqliteTable(
	"agent_identity",
	{
		conversationId: text("conversation_id").primaryKey(),
		agentId: text("agent_id").unique(),
		hostId: text("host_id").notNull(),
		publicKey: text("public_key").notNull(),
		privateKey: text("private_key").notNull(),
		status: text("status", { enum: ["pending", "active", "revoked"] })
			.notNull()
			.default("pending"),
		capabilities: text("capabilities").notNull(),
		...timestamps,
	},
	(table) => [index("agent_identity_host_id_idx").on(table.hostId)],
);

export const identityRelations = relations(hostIdentity, ({ many }) => ({
	agents: many(agentIdentity),
}));

export const identitySchema = { hostIdentity, agentIdentity, identityRelations };
