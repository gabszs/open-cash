import type { dbType } from "@server/db";

import { BaseD1Repository } from "@server/common/repository/baseRepository";
import { conversations } from "@server/db/models/conversations";

/**
 * Conversation rows are written once at creation. Generic persistence comes
 * from the D1 base; the service always adds userId to reads so a foreign id is
 * indistinguishable from one that does not exist.
 */
export class ConversationsRepository extends BaseD1Repository<typeof conversations> {
	constructor(db: dbType) {
		super(conversations, db);
	}
}
