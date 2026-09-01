import { describe, expect, it } from "vitest";

import { loginUser, registerUser, verifyUserEmail } from "../../../helpers/auth";
import { jsonRequestHeaders, requestApp } from "../../../helpers/http";

describe("authentication routes", () => {
	it("registers, verifies, and signs in a user through HTTP", async () => {
		const user = await registerUser({ name: "Auth Integration" });
		await verifyUserEmail(user.email);

		const cookie = await loginUser(user.email, user.password);

		expect(cookie).toContain("better-auth.session_token=");
	});

	it("rejects invalid credentials", async () => {
		const user = await registerUser();
		await verifyUserEmail(user.email);

		const response = await requestApp("/v1/auth/sign-in/email", {
			body: JSON.stringify({ email: user.email, password: "not-the-password" }),
			headers: jsonRequestHeaders(),
			method: "POST",
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: expect.any(String) });
	});
});
