import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";

import { users } from "./authModels";
import { connections } from "./connections";

export const userSettings = sqliteTable(
	"user_settings",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		theme: text("theme").notNull().default("system"),
		userId: text("user_id")
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: "cascade" }),
		connectionId: text("connection_id").references(() => connections.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("user_settings_userId_idx").on(table.userId)],
);
