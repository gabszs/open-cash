import { users } from "@server/db/models/authModels";
import { connections } from "@server/db/models/connections";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";

/** AI surfaces that own conversations. One entry per agent feature. */
export const AI_FEATURES = ["finance"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

// Timestamps stay as Unix seconds. The frontend owns date formatting.
export const conversations = sqliteTable(
	"conversations",
	{
		// Pinned at creation, never re-read from settings: the agent calls MCP in a
		// durable execution that may run hours later, and an old conversation must
		// not start answering about whichever connection is selected by then.
		// Nullable only because deleting a connection nulls it — see `onDelete`.
		// The create route still requires one, so a conversation never starts unscoped.
		connectionId: text("connection_id").references(() => connections.id, {
			onDelete: "set null",
		}),
		feature: text("feature", { enum: AI_FEATURES }).notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		title: text("title").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("conversations_user_feature_created_idx").on(
			table.userId,
			table.feature,
			table.createdAt,
		),
	],
);
