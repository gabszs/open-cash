import type { dbType } from "@server/db";

import { connections } from "@server/db/models/connections";
import { userSettings } from "@server/db/models/userSettings";
import { and, eq } from "drizzle-orm";

/**
 * The active connection for a cookie-authenticated caller, read straight from
 * settings the way the AI proxy reads the user id — no query parameter, so the
 * client contract does not change.
 *
 * Null means nothing is selected, and every scoped read treats that as zero rows.
 * The agent path does NOT come through here: it uses the connection pinned on the
 * conversation, because it runs durably and may execute long after the selection
 * has moved on.
 */
export async function resolveConnectionScope(db: dbType, userId: string) {
	const [row] = await db
		.select({ connectionId: userSettings.connectionId })
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.limit(1);
	return row?.connectionId ?? null;
}

/**
 * Whether a connection exists AND belongs to the caller.
 *
 * The foreign keys on `user_settings.connection_id` and `conversations.connection_id`
 * only prove the connection exists — nothing stops a user from pointing either at
 * someone else's row. This is that missing check, kept in one place because both
 * write paths need exactly the same one. Callers raise their own error type: the
 * settings path speaks ORPCError, the conversations path speaks httpErrors.
 */
export async function isOwnedConnection(db: dbType, userId: string, connectionId: string) {
	const [row] = await db
		.select({ id: connections.id })
		.from(connections)
		.where(and(eq(connections.id, connectionId), eq(connections.userId, userId)))
		.limit(1);
	return row !== undefined;
}
