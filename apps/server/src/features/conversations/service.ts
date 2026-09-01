import type { AiFeature, conversations } from "@server/db/models/conversations";

import { BaseD1Service } from "@server/common/services/baseD1Service";
import { isOwnedConnection } from "@server/lib/connectionScope";
import { httpErrors } from "@server/lib/errors";

import type { ConversationsRepository } from "./repository";
import type { ConversationCreateInput, ConversationsListInput } from "./schemas";

/**
 * Owns every rule about conversations. The AI proxy delegates its ownership
 * check here rather than reaching for the database itself, so this stays the
 * single place that decides whether a conversation belongs to a caller.
 *
 * Rows go out as they come back from the database, so ordinary persistence is
 * inherited from `BaseD1Service`; what is not inherited is the scoping, which
 * is why the reads below exist rather than the base ones being exposed.
 */
export class ConversationsService extends BaseD1Service<
	typeof conversations,
	ConversationsRepository
> {
	/** Always scoped to the caller, so a listing can never span users. */
	async listConversations(userId: string, { feature, ...searchOptions }: ConversationsListInput) {
		return await this.getAll(searchOptions, { feature, userId });
	}

	/**
	 * Pins the connection for the life of the conversation. The ownership check is
	 * not optional: the foreign key only proves the connection exists, so without it
	 * a user could aim a conversation — and therefore the agent's MCP reads — at
	 * someone else's connection.
	 */
	async createConversation(
		userId: string,
		{ connectionId, feature, title }: ConversationCreateInput,
	) {
		if (!(await isOwnedConnection(this.repository.db, userId, connectionId))) {
			throw httpErrors.create("FINANCE_CONNECTION_NOT_FOUND");
		}
		return await this.create({ connectionId, feature, title, userId });
	}

	/**
	 * Loads a conversation the caller owns, or throws. `feature` narrows the
	 * lookup so an id minted for one agent cannot be replayed against another.
	 */
	async requireOwned(userId: string, id: string, feature?: AiFeature) {
		const conversation = await this.getById(id, { feature, userId });
		if (!conversation) throw httpErrors.create("CONVERSATION_NOT_FOUND");
		return conversation;
	}
}
