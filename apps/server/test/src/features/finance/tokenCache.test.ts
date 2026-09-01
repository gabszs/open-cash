import { describe, expect, test } from "bun:test";

import {
	kvTokenCache,
	tokenCacheKey,
	tokenTtlSeconds,
} from "../../../../src/features/finance/pluggy/tokenCache";

/* oxlint-disable eslint/no-use-before-define -- The KV fixture stays below the behavioral tests. */

const jwt = (exp: number) =>
	`header.${btoa(JSON.stringify({ exp })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}.signature`;

describe("Pluggy token cache key", () => {
	test("namespaces the key and is stable for the same user connection", async () => {
		const scope = { userId: "user-1", connectionId: "connection-1" };

		const key = await tokenCacheKey(scope);
		expect(key).toMatch(/^pluggy:apikey:[\da-f]{32}$/u);
		expect(await tokenCacheKey({ ...scope })).toBe(key);
	});

	test("isolates users and connections", async () => {
		const first = await tokenCacheKey({ userId: "user-1", connectionId: "connection-1" });
		const anotherUser = await tokenCacheKey({
			userId: "user-2",
			connectionId: "connection-1",
		});
		const anotherConnection = await tokenCacheKey({
			userId: "user-1",
			connectionId: "connection-2",
		});

		expect(anotherUser).not.toBe(first);
		expect(anotherConnection).not.toBe(first);
	});
});

describe("Pluggy token TTL", () => {
	test("derives the lifetime from the token expiry minus a renewal margin", () => {
		const now = 1_800_000_000;

		expect(tokenTtlSeconds(jwt(now + 7200), now)).toBe(6900);
	});

	test("clamps a near-expired or absurdly long token into a usable window", () => {
		const now = 1_800_000_000;

		expect(tokenTtlSeconds(jwt(now + 10), now)).toBe(60);
		expect(tokenTtlSeconds(jwt(now + 86_400), now)).toBe(7200);
	});

	test("falls back when the token carries no readable expiry", () => {
		expect(tokenTtlSeconds("not-a-jwt")).toBe(5400);
		expect(tokenTtlSeconds("header.bm90LWpzb24.signature")).toBe(5400);
	});
});

describe("Pluggy token KV adapter", () => {
	test("seals the token at rest and round trips it", async () => {
		const kv = fakeKv();
		const cache = kvTokenCache(kv, "encryption-key");

		await cache.set("pluggy:apikey:abc", "provider-token", 600);

		expect(kv.store.get("pluggy:apikey:abc")?.value).not.toContain("provider-token");
		expect(kv.store.get("pluggy:apikey:abc")?.ttl).toBe(600);
		expect(await cache.get("pluggy:apikey:abc")).toBe("provider-token");
	});

	test("reports a missing entry as a miss and drops a deleted one", async () => {
		const kv = fakeKv();
		const cache = kvTokenCache(kv, "encryption-key");

		expect(await cache.get("pluggy:apikey:missing")).toBeNull();

		await cache.set("pluggy:apikey:abc", "provider-token", 600);
		await cache.delete("pluggy:apikey:abc");
		expect(await cache.get("pluggy:apikey:abc")).toBeNull();
	});
});

const fakeKv = () => {
	const store = new Map<string, { value: string; ttl: number | undefined }>();
	return {
		store,
		get: (key: string) => Promise.resolve(store.get(key)?.value ?? null),
		put: (key: string, value: string, options?: { expirationTtl?: number }) => {
			store.set(key, { value, ttl: options?.expirationTtl });
			return Promise.resolve();
		},
		delete: (key: string) => {
			store.delete(key);
			return Promise.resolve();
		},
	} as unknown as KVNamespace & {
		store: Map<string, { value: string; ttl: number | undefined }>;
	};
};
