import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "../../../helpers/auth";

import { getDb } from "../../../../src/db";
import { ConnectionsRepository } from "../../../../src/features/connections/repository";
import { seal } from "../../../../src/lib/secrets";
import { createAuthenticatedUser } from "../../../helpers/auth";
import { jsonRequestHeaders, requestApp } from "../../../helpers/http";

const CONNECTIONS = "/v1/connections";
const UNKNOWN_ID = "019318f2-7c41-7a3b-8f2e-1abdcf496130";

interface ConnectionResponse {
	clientId: string;
	createdAt: string;
	id: string;
	itemIds: string[];
	name: string;
	provider: string;
	updatedAt: string;
}

// Seeded straight through the repository: creating over HTTP would verify the
// credentials against Pluggy, and these tests must not reach the network.
const seedConnection = async (userId: string, name: string) =>
	await new ConnectionsRepository(getDb(env)).create({
		userId,
		name,
		clientId: `${name}-client`,
		sealedClientSecret: await seal(`${name}-secret`, env.FINANCE_ENCRYPTION_KEY),
		itemIds: [`${name}-item`],
	});

// Two users for the whole file: the auth rate limiter is keyed per client IP, and
// every createAuthenticatedUser() costs a sign-up plus a sign-in.
describe("connection routes", () => {
	let owner: AuthenticatedUser;
	let other: AuthenticatedUser;
	let ownerConnection: string;
	let otherConnection: string;

	beforeAll(async () => {
		owner = await createAuthenticatedUser({ name: "Connections Owner" });
		other = await createAuthenticatedUser({ name: "Connections Other" });
		const created = await Promise.all([
			seedConnection(owner.userId, "owner-bank"),
			seedConnection(other.userId, "other-bank"),
		]);
		[ownerConnection, otherConnection] = created.map((row) => row.id) as [string, string];
	});

	it("rejects every route without a session", async () => {
		const list = await requestApp(CONNECTIONS);
		const create = await requestApp(CONNECTIONS, {
			body: JSON.stringify({
				clientId: "c",
				clientSecret: "s",
				itemIds: ["i"],
				name: "Bank",
			}),
			headers: jsonRequestHeaders(),
			method: "POST",
		});
		const detail = await requestApp(`${CONNECTIONS}/${UNKNOWN_ID}`);
		const patch = await requestApp(`${CONNECTIONS}/${UNKNOWN_ID}`, {
			body: JSON.stringify({ name: "Renamed" }),
			headers: jsonRequestHeaders(),
			method: "PATCH",
		});
		const remove = await requestApp(`${CONNECTIONS}/${UNKNOWN_ID}`, { method: "DELETE" });

		expect([list.status, create.status, detail.status, patch.status, remove.status]).toEqual([
			401, 401, 401, 401, 401,
		]);
		await Promise.all([list.text(), create.text(), detail.text(), patch.text(), remove.text()]);
	});

	it("isolates connections and encrypted credentials between users", async () => {
		const response = await requestApp(CONNECTIONS, { headers: { Cookie: owner.cookie } });

		expect(response.status).toBe(200);
		const body = await response.text();
		expect(JSON.parse(body)).toEqual([
			expect.objectContaining({ id: ownerConnection, clientId: "owner-bank-client" }),
		]);
		expect(body).not.toContain(otherConnection);
		expect(body).not.toContain("owner-bank-secret");
		expect(body).not.toContain("sealedClientSecret");
	});

	it("reads back one owned connection without its credential", async () => {
		const response = await requestApp(`${CONNECTIONS}/${ownerConnection}`, {
			headers: { Cookie: owner.cookie },
		});

		expect(response.status).toBe(200);
		const connection = await response.json<ConnectionResponse>();
		expect(connection).toEqual(
			expect.objectContaining({
				clientId: "owner-bank-client",
				id: ownerConnection,
				itemIds: ["owner-bank-item"],
				name: "owner-bank",
				provider: "pluggy",
			}),
		);
		// Field-for-field: a leaked column would slip past objectContaining.
		expect(Object.keys(connection).toSorted()).toEqual([
			"clientId",
			"createdAt",
			"id",
			"itemIds",
			"name",
			"provider",
			"updatedAt",
		]);
	});

	it("renames a connection without contacting the provider", async () => {
		const response = await requestApp(`${CONNECTIONS}/${ownerConnection}`, {
			body: JSON.stringify({ name: "owner-bank renamed" }),
			headers: jsonRequestHeaders(owner.cookie),
			method: "PATCH",
		});

		expect(response.status).toBe(200);
		const connection = await response.json<ConnectionResponse>();
		expect(connection.name).toBe("owner-bank renamed");
		// Untouched by a rename, so the stored credential was never reopened.
		expect(connection.clientId).toBe("owner-bank-client");
		expect(connection.itemIds).toEqual(["owner-bank-item"]);
	});

	it("answers not found for a connection owned by another user", async () => {
		const detail = await requestApp(`${CONNECTIONS}/${otherConnection}`, {
			headers: { Cookie: owner.cookie },
		});
		const patch = await requestApp(`${CONNECTIONS}/${otherConnection}`, {
			body: JSON.stringify({ name: "hijacked" }),
			headers: jsonRequestHeaders(owner.cookie),
			method: "PATCH",
		});
		const remove = await requestApp(`${CONNECTIONS}/${otherConnection}`, {
			headers: { Cookie: owner.cookie },
			method: "DELETE",
		});

		expect([detail.status, patch.status, remove.status]).toEqual([404, 404, 404]);
		await Promise.all([detail.text(), patch.text(), remove.text()]);

		// Not found means untouched, not merely hidden.
		const stillThere = await requestApp(`${CONNECTIONS}/${otherConnection}`, {
			headers: { Cookie: other.cookie },
		});
		expect(stillThere.status).toBe(200);
		const untouched = await stillThere.json<ConnectionResponse>();
		expect(untouched.name).toBe("other-bank");
	});

	it("rejects an invalid create payload before reaching the provider", async () => {
		const response = await requestApp(CONNECTIONS, {
			body: JSON.stringify({ clientId: "", clientSecret: "s", itemIds: [], name: "" }),
			headers: jsonRequestHeaders(owner.cookie),
			method: "POST",
		});

		expect(response.status).toBe(422);
		const problem = await response.json<{ errors: { field: string }[] }>();
		expect(problem.errors.map((error) => error.field).toSorted()).toEqual([
			"clientId",
			"itemIds",
			"name",
		]);
	});

	it("deletes an owned connection and stops listing it", async () => {
		const disposable = await seedConnection(owner.userId, "disposable-bank");

		const removed = await requestApp(`${CONNECTIONS}/${disposable.id}`, {
			headers: { Cookie: owner.cookie },
			method: "DELETE",
		});
		expect(removed.status).toBe(204);

		const list = await requestApp(CONNECTIONS, { headers: { Cookie: owner.cookie } });
		const remaining = await list.json<ConnectionResponse[]>();
		expect(remaining.map((connection) => connection.id)).toEqual([ownerConnection]);
	});
});
