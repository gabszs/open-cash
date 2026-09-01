import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { BaseD1Repository } from "../../../../src/common/repository/baseRepository";
import { getDb } from "../../../../src/db";
import { connections } from "../../../../src/db/models/connections";
import { createAuthenticatedUser } from "../../../helpers/auth";

const searchOptions = {
	ordering: "-created_at",
	page: 1,
	page_size: 10,
} as const;

const connectionValues = (userId: string, name: string) => ({
	clientId: `${name}-client`,
	itemIds: [`${name}-item`],
	name,
	sealedClientSecret: `${name}-sealed-secret`,
	userId,
});

describe("BaseD1Repository", () => {
	it("reuses typed CRUD, filtering, pagination, and count for a D1 model", async () => {
		const user = await createAuthenticatedUser({ name: "Base repository owner" });
		const repository = new BaseD1Repository(connections, getDb(env));

		const first = await repository.create(connectionValues(user.userId, "base-first"));
		const second = await repository.create(connectionValues(user.userId, "base-second"));

		expect(await repository.getById(first.id, { userId: user.userId })).toEqual(first);
		expect(await repository.count({ userId: user.userId })).toBe(2);
		expect(await repository.getAll(searchOptions, { userId: user.userId })).toHaveLength(2);

		const updated = await repository.update(
			first.id,
			{ name: "base-updated" },
			{ userId: user.userId },
		);
		expect(updated?.name).toBe("base-updated");

		expect(await repository.delete(second.id, { userId: "not-the-owner" })).toBe(false);
		expect(await repository.delete(second.id, { userId: user.userId })).toBe(true);
		expect(await repository.getById(second.id)).toBeNull();
	});

	it("rejects unknown columns instead of silently dropping a security filter", async () => {
		const repository = new BaseD1Repository(connections, getDb(env));

		await expect(repository.count({ tenantId: "missing" } as never)).rejects.toThrow(
			"Unknown repository column: tenantId",
		);
	});
});
