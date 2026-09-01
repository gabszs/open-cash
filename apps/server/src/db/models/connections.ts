import { users } from "@server/db/models/authModels";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";

export const connections = sqliteTable(
	"connections",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		provider: text("provider").notNull().default("pluggy"),
		clientId: text("client_id").notNull(),
		sealedClientSecret: text("sealed_client_secret").notNull(),
		itemIds: text("item_ids", { mode: "json" }).$type<string[]>().notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("connections_user_id_idx").on(table.userId),
		uniqueIndex("connections_user_name_uidx").on(table.userId, table.name),
	],
);
