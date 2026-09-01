import type { D1Db } from "@server/db";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { models } from "@server/db/models";
import { and, eq, sql } from "drizzle-orm";

/**
 * `undefined` means unscoped — connection management, writes and tests. A string
 * scopes reads to that one connection. `null` means the user has selected nothing,
 * which reads as zero rows: the one thing it must never mean is "all connections".
 */
export type ConnectionScope = string | null | undefined;

export class FinanceRepository {
	private readonly db: D1Db;
	private readonly scope: ConnectionScope;

	/**
	 * The scope is a constructor argument because repository and service are built
	 * per request. That keeps provider scoping out of individual service, route,
	 * and MCP tool signatures.
	 */
	constructor(db: D1Db, scope?: ConnectionScope) {
		this.db = db;
		this.scope = scope;
	}

	/** The active scope, so callers can bind it into pagination cursors. */
	get connectionScope(): ConnectionScope {
		return this.scope;
	}

	/** Undefined when unscoped, so `and()` drops it; a false predicate when null. */
	private scopeFilter(column: AnySQLiteColumn) {
		if (this.scope === undefined) return;
		if (this.scope === null) return sql`1 = 0`;
		return eq(column, this.scope);
	}

	/**
	 * Whether an explicitly requested connection sits inside the active scope.
	 * Only data selection consults this — connection management stays unscoped, or
	 * a bad selection could never be edited away.
	 */
	allowsConnection(connectionId: string) {
		return this.scope === undefined || this.scope === connectionId;
	}

	/**
	 * What the provider-read loops iterate. Filtering only the final result would
	 * still contact Pluggy for every connection, so scope is applied before I/O.
	 */
	listScopedConnections(userId: string) {
		return this.db
			.select()
			.from(models.connections)
			.where(
				and(eq(models.connections.userId, userId), this.scopeFilter(models.connections.id)),
			);
	}

	/**
	 * Reads only: the credentials behind one connection. Managing the row itself
	 * lives in `features/connections`, which is unscoped by design.
	 */
	async getConnection(id: string, userId: string) {
		const [row] = await this.db
			.select()
			.from(models.connections)
			.where(and(eq(models.connections.id, id), eq(models.connections.userId, userId)))
			.limit(1);
		return row ?? null;
	}
}
