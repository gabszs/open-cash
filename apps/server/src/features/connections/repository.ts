import type { dbType } from "@server/db";

import { BaseD1Repository } from "@server/common/repository/baseRepository";
import { connections } from "@server/db/models/connections";

/**
 * Generic persistence comes from the D1 base. The service always adds `userId`
 * to reads and writes, so a connection owned by someone else is indistinguishable
 * from one that does not exist.
 *
 * Deliberately unscoped by the active connection selection: this backs connection
 * management and the picker itself, and a bad selection has to stay editable.
 */
export class ConnectionsRepository extends BaseD1Repository<typeof connections> {
	constructor(db: dbType) {
		super(connections, db);
	}
}
