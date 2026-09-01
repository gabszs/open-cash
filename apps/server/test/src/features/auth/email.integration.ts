import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import { registerUser } from "../../../helpers/auth";
import { jsonRequestHeaders, requestApp } from "../../../helpers/http";

const spyOnEmailBinding = () =>
	vi.spyOn(env.EMAIL, "send").mockResolvedValue({ messageId: "test" });

describe("transactional auth emails", () => {
	it("sends a verification email through the binding when an unverified user signs in", async () => {
		const user = await registerUser({ name: "Email Integration" });
		const send = spyOnEmailBinding();

		const response = await requestApp("/v1/auth/sign-in/email", {
			body: JSON.stringify({ email: user.email, password: user.password }),
			headers: jsonRequestHeaders(),
			method: "POST",
		});

		expect(response.status).toBe(403);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0]?.[0]).toMatchObject({
			from: { email: "noreply@open-cash.example.com", name: "open-cash" },
			subject: "Verify your open-cash email address",
			to: user.email,
		});

		const message = send.mock.calls[0]?.[0] as { text: string };
		const verificationUrl = message.text.match(/Verify email: (?<url>\S+)/u)?.groups?.url;
		expect(verificationUrl).toBeDefined();
		const verified = await requestApp(
			new URL(verificationUrl ?? "", "http://localhost").pathname +
				new URL(verificationUrl ?? "", "http://localhost").search,
		);
		expect(verified.status).toBe(302);
		await verified.text();

		const hosts = await env.DATABASE.prepare(
			"SELECT id, user_id, public_key, status FROM agent_hosts WHERE user_id = ?",
		)
			.bind(user.userId)
			.all<{ id: string; public_key: string; status: string; user_id: string }>();
		expect(hosts.results).toHaveLength(1);
		expect(hosts.results[0]).toMatchObject({ status: "active", user_id: user.userId });
		expect(hosts.results[0]?.public_key).toContain('"crv":"Ed25519"');
	});

	it("sends a password reset email through the binding", async () => {
		const user = await registerUser({ name: "Reset Integration" });
		const send = spyOnEmailBinding();

		const response = await requestApp("/v1/auth/request-password-reset", {
			body: JSON.stringify({ email: user.email, redirectTo: "http://localhost/reset" }),
			headers: jsonRequestHeaders(),
			method: "POST",
		});

		expect(response.status).toBe(200);
		expect(send).toHaveBeenCalledTimes(1);

		const message = send.mock.calls[0]?.[0] as { html: string; text: string };
		expect(message.text).toContain("/v1/auth/reset-password/");
		expect(message.html).toContain("Reset password");
	});
});
