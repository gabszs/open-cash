import type { searchOptionsSchemaType } from "@server/common/schemas/baseSchemas";
import type { Connection as ConnectionRow } from "@server/db/models";
import type { connections } from "@server/db/models/connections";
import type { PluggyCredentials } from "@server/features/finance/pluggy/client";
import type {
	PluggyTokenCache,
	PluggyTokenCacheScope,
} from "@server/features/finance/pluggy/tokenCache";

import { BaseD1Service } from "@server/common/services/baseD1Service";
import { PluggyClient } from "@server/features/finance/pluggy/client";
import { tokenCacheKey } from "@server/features/finance/pluggy/tokenCache";
import { httpErrors } from "@server/lib/errors";
import { seal, unseal } from "@server/lib/secrets";

import type { ConnectionsRepository } from "./repository";
import type { ConnectionCreate, ConnectionUpdate } from "./schemas";

/**
 * The row minus the credential. The base repository selects whole rows, so this
 * is the only thing standing between `sealedClientSecret` and a response body.
 */
const publicConnection = (row: ConnectionRow) => ({
	id: row.id,
	name: row.name,
	provider: "pluggy" as const,
	clientId: row.clientId,
	itemIds: row.itemIds,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
});

/**
 * Owns every rule about connections. Credentials are verified against Pluggy
 * before they are stored, so a connection that exists is a connection that works
 * — and they are sealed at rest, so nothing here ever hands one back out.
 *
 * Persistence is inherited from `BaseD1Service`, but none of it is re-exposed:
 * every method below adds something the base cannot know about — the owner
 * filter, the provider round trip, or `publicConnection`.
 */
export class ConnectionsService extends BaseD1Service<typeof connections, ConnectionsRepository> {
	private readonly encryptionKey: string;
	private readonly tokenCache: PluggyTokenCache | undefined;

	constructor(
		repository: ConnectionsRepository,
		encryptionKey: string,
		tokenCache?: PluggyTokenCache,
	) {
		super(repository);
		this.encryptionKey = encryptionKey;
		this.tokenCache = tokenCache;
	}

	/** Every provider call goes through here so it shares the scoped API key. */
	private pluggy(credentials: PluggyCredentials, cacheScope?: PluggyTokenCacheScope) {
		return new PluggyClient(credentials, undefined, this.tokenCache, cacheScope);
	}

	async listConnections(userId: string, searchOptions: searchOptionsSchemaType) {
		const rows = await this.getAll(searchOptions, { userId });
		return rows.map(publicConnection);
	}

	async getConnection(connectionId: string, userId: string) {
		return publicConnection(await this.requiredConnection(connectionId, userId));
	}

	async createConnection(userId: string, input: ConnectionCreate) {
		const itemIds = [...new Set(input.itemIds)];
		await this.pluggy(input).verify(itemIds);
		return publicConnection(
			await this.create({
				userId,
				name: input.name,
				clientId: input.clientId,
				itemIds,
				sealedClientSecret: await seal(input.clientSecret, this.encryptionKey),
			}),
		);
	}

	async updateConnection(connectionId: string, userId: string, input: ConnectionUpdate) {
		const current = await this.requiredConnection(connectionId, userId);
		const itemIds = [...new Set(input.itemIds ?? current.itemIds)];
		// Renaming touches nothing the provider knows about, so it should neither hit
		// the network nor need the stored secret decrypted.
		const touchesProvider =
			input.clientId !== undefined ||
			input.clientSecret !== undefined ||
			input.itemIds !== undefined;
		if (touchesProvider) {
			await this.evictToken(userId, connectionId);
			await this.pluggy(
				{
					clientId: input.clientId ?? current.clientId,
					clientSecret:
						input.clientSecret ??
						(await unseal(current.sealedClientSecret, this.encryptionKey)),
				},
				{ userId, connectionId },
			).verify(itemIds);
		}
		const row = await this.update(
			connectionId,
			{
				...(input.name === undefined ? {} : { name: input.name }),
				...(input.clientId === undefined ? {} : { clientId: input.clientId }),
				itemIds,
				...(input.clientSecret === undefined
					? {}
					: { sealedClientSecret: await seal(input.clientSecret, this.encryptionKey) }),
			},
			{ userId },
		);
		if (!row) throw httpErrors.create("FINANCE_CONNECTION_NOT_FOUND");
		return publicConnection(row);
	}

	async deleteConnection(connectionId: string, userId: string) {
		if (!(await this.delete(connectionId, { userId }))) {
			throw httpErrors.create("FINANCE_CONNECTION_NOT_FOUND");
		}
		await this.evictToken(userId, connectionId);
	}

	private async evictToken(userId: string, connectionId: string) {
		if (!this.tokenCache) return;
		try {
			await this.tokenCache.delete(await tokenCacheKey({ userId, connectionId }));
		} catch {
			// Cache failures only cost another provider authentication round trip.
		}
	}

	/** Ownership is a filter, so a foreign id answers not-found rather than forbidden. */
	private async requiredConnection(connectionId: string, userId: string) {
		const row = await this.getById(connectionId, { userId });
		if (!row) throw httpErrors.create("FINANCE_CONNECTION_NOT_FOUND");
		return row;
	}
}
