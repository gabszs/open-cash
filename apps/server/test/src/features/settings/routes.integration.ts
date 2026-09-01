import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { getDb } from "../../../../src/db";
import { ConnectionsRepository } from "../../../../src/features/connections/repository";
import { seal } from "../../../../src/lib/secrets";
import { createAuthenticatedUser } from "../../../helpers/auth";
import { jsonRequestHeaders, requestApp } from "../../../helpers/http";

const createConnection = async (userId: string, name: string) =>
	await new ConnectionsRepository(getDb(env)).create({
		userId,
		name,
		clientId: `${name}-client`,
		sealedClientSecret: await seal(`${name}-secret`, env.FINANCE_ENCRYPTION_KEY),
		itemIds: [`${name}-item`],
	});

describe("settings routes", () => {
	it("rejects requests without a session", async () => {
		const response = await requestApp("/orpc-openapi/settings");

		expect(response.status).toBe(401);
		await response.text();
	});

	it("returns not found before settings are created", async () => {
		const user = await createAuthenticatedUser();
		const response = await requestApp("/orpc-openapi/settings", {
			headers: { Cookie: user.cookie },
		});

		expect(response.status).toBe(404);
		await response.text();
	});

	it("creates settings on update and returns their persisted value", async () => {
		const user = await createAuthenticatedUser();
		const updateResponse = await requestApp("/orpc-openapi/settings", {
			body: JSON.stringify({ theme: "dark" }),
			headers: jsonRequestHeaders(user.cookie),
			method: "PATCH",
		});

		expect(updateResponse.status).toBe(200);
		expect(await updateResponse.json()).toEqual({ connectionId: null, theme: "dark" });

		const getResponse = await requestApp("/orpc-openapi/settings", {
			headers: { Cookie: user.cookie },
		});
		expect(getResponse.status).toBe(200);
		expect(await getResponse.json()).toEqual({ connectionId: null, theme: "dark" });
	});

	it("selects a connection the user owns and clears it again", async () => {
		const user = await createAuthenticatedUser({ name: "Settings Owner" });
		const connection = await createConnection(user.userId, "owned-bank");

		const selectResponse = await requestApp("/orpc-openapi/settings", {
			body: JSON.stringify({ connectionId: connection.id }),
			headers: jsonRequestHeaders(user.cookie),
			method: "PATCH",
		});
		expect(selectResponse.status).toBe(200);
		expect(await selectResponse.json()).toEqual({
			connectionId: connection.id,
			theme: "system",
		});

		// An explicit null is the clear action, not "field omitted".
		const clearResponse = await requestApp("/orpc-openapi/settings", {
			body: JSON.stringify({ connectionId: null }),
			headers: jsonRequestHeaders(user.cookie),
			method: "PATCH",
		});
		expect(clearResponse.status).toBe(200);
		expect(await clearResponse.json()).toEqual({ connectionId: null, theme: "system" });
	});

	it("refuses a connection owned by another user", async () => {
		const [user, other] = await Promise.all([
			createAuthenticatedUser({ name: "Settings Intruder" }),
			createAuthenticatedUser({ name: "Settings Victim" }),
		]);
		const foreign = await createConnection(other.userId, "victim-bank");

		const response = await requestApp("/orpc-openapi/settings", {
			body: JSON.stringify({ connectionId: foreign.id }),
			headers: jsonRequestHeaders(user.cookie),
			method: "PATCH",
		});

		expect(response.status).toBe(404);
		await response.text();

		// The rejected write must not have created or touched a settings row.
		const getResponse = await requestApp("/orpc-openapi/settings", {
			headers: { Cookie: user.cookie },
		});
		expect(getResponse.status).toBe(404);
		await getResponse.text();
	});
});
