import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "../../../../src/db";
import { sessions } from "../../../../src/db/models/authModels";
import { createAuthenticatedUser } from "../../../helpers/auth";
import { jsonRequestHeaders, requestApp } from "../../../helpers/http";

describe("profile routes", () => {
	it("rejects requests without a session", async () => {
		const response = await requestApp("/orpc-openapi/profile");

		expect(response.status).toBe(401);
		await response.text();
	});

	it("reads and updates the authenticated profile", async () => {
		const user = await createAuthenticatedUser({ name: "Original Name" });
		const getResponse = await requestApp("/orpc-openapi/profile", {
			headers: { Cookie: user.cookie },
		});

		expect(getResponse.status).toBe(200);
		expect(await getResponse.json()).toMatchObject({
			email: user.email,
			id: user.userId,
			name: "Original Name",
		});

		const updateResponse = await requestApp("/orpc-openapi/profile", {
			body: JSON.stringify({
				image: "https://example.test/avatar.png",
				name: "Updated Name",
			}),
			headers: jsonRequestHeaders(user.cookie),
			method: "PATCH",
		});

		expect(updateResponse.status).toBe(200);
		expect(await updateResponse.json()).toMatchObject({
			image: "https://example.test/avatar.png",
			name: "Updated Name",
		});
	});

	it("computes initials and device information through HTTP", async () => {
		const user = await createAuthenticatedUser();
		const initialsResponse = await requestApp("/orpc-openapi/profile/initials", {
			body: JSON.stringify({ email: user.email, name: "Open Cash User" }),
			headers: jsonRequestHeaders(user.cookie),
			method: "POST",
		});
		const deviceResponse = await requestApp("/orpc-openapi/profile/device-info", {
			body: JSON.stringify({ userAgent: "Mozilla/5.0 Chrome Linux" }),
			headers: jsonRequestHeaders(user.cookie),
			method: "POST",
		});

		expect(initialsResponse.status).toBe(200);
		expect(await initialsResponse.json()).toBe("OC");
		expect(deviceResponse.status).toBe(200);
		expect(await deviceResponse.json()).toBe("Chrome, Linux");
	});

	it("lists and revokes an authenticated user session", async () => {
		const user = await createAuthenticatedUser();
		const listResponse = await requestApp("/orpc-openapi/profile/sessions", {
			headers: { Cookie: user.cookie },
		});

		expect(listResponse.status).toBe(200);
		const listedSessions = await listResponse.json<Record<string, unknown>[]>();
		expect(listedSessions.length).toBeGreaterThan(0);

		const db = getDb(env);
		const [session] = await db
			.select({ token: sessions.token })
			.from(sessions)
			.where(eq(sessions.userId, user.userId))
			.limit(1);
		expect(session).toBeDefined();

		const revokeResponse = await requestApp("/orpc-openapi/profile/sessions/revoke", {
			body: JSON.stringify({ token: session?.token }),
			headers: jsonRequestHeaders(user.cookie),
			method: "POST",
		});

		expect(revokeResponse.status).toBe(200);
		expect(await revokeResponse.json()).toEqual({ success: true });
	});
});
