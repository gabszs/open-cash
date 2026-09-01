import { env } from "cloudflare:workers";
import { S3mini } from "s3mini";
import { describe, expect, it } from "vitest";

import { app } from "../../src";

describe("worker bindings", () => {
	it("fails closed for MCP requests without an Agent Auth session", async () => {
		const response = await app.request(
			new Request("http://localhost/mcp", { method: "GET" }),
			undefined,
			env,
		);

		expect(response.status).toBe(401);
		await response.text();
	});

	it("provides isolated Cloudflare bindings and external services", async () => {
		const key = `binding-smoke/${crypto.randomUUID()}`;

		await env.CACHE.put(key, "kv-ok");
		expect(await env.CACHE.get(key)).toBe("kv-ok");

		await env.R2.put(key, "r2-ok");
		const object = await env.R2.get(key);
		expect(object).not.toBeNull();
		expect(await object?.text()).toBe("r2-ok");
		await env.R2.delete(key);

		const s3 = new S3mini({
			accessKeyId: env.R2_ACCESS_KEY_ID,
			endpoint: env.R2_S3_ENDPOINT,
			region: "us-east-1",
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		});
		expect(await s3.bucketExists()).toBe(true);

		const d1 = await env.DATABASE.prepare("SELECT 1 AS value").first<{ value: number }>();
		expect(d1).toEqual({ value: 1 });
		expect(typeof env.EMAIL.send).toBe("function");
		expect(await env.RATE_LIMIT.limit({ key })).toEqual({ success: true });
		expect(env.VERSION_METADATA).toMatchObject({
			id: expect.any(String),
			tag: expect.any(String),
			timestamp: expect.any(String),
		});
		expect(String(env.ENVIRONMENT)).toBe("test");
	});
});
