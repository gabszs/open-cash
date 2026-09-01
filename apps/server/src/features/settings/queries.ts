import type { Context } from "@server/lib/orpc";

import { ORPCError } from "@orpc/server";
import { isOwnedConnection } from "@server/lib/connectionScope";
import { eq } from "drizzle-orm";

import { userSettings } from "../../db/models/userSettings";
import { DEFAULT_SETTINGS } from "./types";

export async function getUserSettings(db: Context["db"], userId: string) {
	const [row] = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Settings not found" });
	}

	return {
		theme: row.theme ?? DEFAULT_SETTINGS.theme,
		connectionId: row.connectionId ?? null,
	};
}

export async function insertSettingsRow(db: Context["db"], userId: string): Promise<void> {
	const now = new Date();
	await db
		.insert(userSettings)
		.values({
			createdAt: now,
			theme: DEFAULT_SETTINGS.theme,
			updatedAt: now,
			userId,
		})
		.onConflictDoNothing({ target: userSettings.userId });
}

export async function updateUserSettings(
	db: Context["db"],
	userId: string,
	updates: {
		theme?: string;
		connectionId?: string | null;
	},
) {
	// A foreign key proves the connection exists, not that it is this user's.
	if (
		typeof updates.connectionId === "string" &&
		!(await isOwnedConnection(db, userId, updates.connectionId))
	) {
		throw new ORPCError("NOT_FOUND", { message: "Connection not found" });
	}

	await insertSettingsRow(db, userId);

	const set: Partial<typeof userSettings.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (updates.theme !== undefined) {
		set.theme = updates.theme;
	}

	// Compared against `undefined`, not falsiness: an explicit null is the clear
	// action and has to reach `set`, or the guard below drops it silently.
	if (updates.connectionId !== undefined) {
		set.connectionId = updates.connectionId;
	}

	if (Object.keys(set).length > 1) {
		await db.update(userSettings).set(set).where(eq(userSettings.userId, userId));
	}

	return getUserSettings(db, userId);
}
