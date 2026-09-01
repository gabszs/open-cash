import { afterEach, describe, expect, spyOn, test } from "bun:test";

import type { PluggyTokenCache } from "../../../../src/features/finance/pluggy/tokenCache";

import { PluggyClient } from "../../../../src/features/finance/pluggy/client";

/* oxlint-disable eslint/no-use-before-define -- Wire fixture builders stay below the behavioral tests. */

const json = (body: object, status = 200, headers?: HeadersInit) =>
	Response.json(body, { status, headers });

const realFetch = globalThis.fetch;
const DEFAULT_CACHE_SCOPE = { userId: "user", connectionId: "connection" };

afterEach(() => {
	globalThis.fetch = realFetch;
});

const stubFetch = (handler: (url: string, init?: RequestInit) => Promise<Response>) => {
	globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) =>
		handler(String(url), init)) as typeof fetch;
};

const stubTimers = (waits: number[]) =>
	spyOn(globalThis, "setTimeout").mockImplementation(((
		callback: () => void,
		milliseconds?: number,
	) => {
		waits.push(milliseconds ?? 0);
		callback();
		return 0;
	}) as unknown as typeof setTimeout);

const item = {
	id: "provider-item",
	connector: { name: "Test Bank" },
	status: "UPDATED",
	executionStatus: null,
	lastUpdatedAt: "2026-08-01T00:00:00.000Z",
};

describe("Pluggy boundary", () => {
	test("renews the API key once after a 401 without exposing credentials", async () => {
		const keys: string[] = [];
		let authCalls = 0;
		stubFetch(async (url, init) => {
			if (url.endsWith("/auth")) {
				authCalls += 1;
				return json({ apiKey: `key-${authCalls}` });
			}
			keys.push(new Headers(init?.headers).get("X-API-KEY") ?? "");
			return keys.length === 1 ? json({}, 401) : json(item);
		});

		const client = new PluggyClient(
			{ clientId: "client", clientSecret: "secret" },
			"https://pluggy.test",
		);
		const connection = await client.connection("provider-item");
		expect(connection.institution).toBe("Test Bank");
		expect(authCalls).toBe(2);
		expect(keys).toEqual(["key-1", "key-2"]);
	});

	test("honours Retry-After and retries a 429 at most inside the transport", async () => {
		const waits: number[] = [];
		let itemCalls = 0;
		stubFetch(async (url) => {
			if (url.endsWith("/auth")) return json({ apiKey: "key" });
			itemCalls += 1;
			return itemCalls === 1 ? json({}, 429, { "retry-after": "2" }) : json(item);
		});
		const timers = stubTimers(waits);
		const client = new PluggyClient(
			{ clientId: "client", clientSecret: "secret" },
			"https://pluggy.test",
		);

		try {
			const connection = await client.connection("provider-item");
			expect(connection.status).toBe("UPDATED");
			expect(waits).toEqual([2000]);
		} finally {
			timers.mockRestore();
		}
	});

	test("walks every account page and normalizes credit-card transaction signs", async () => {
		stubFetch(async (path) => {
			if (path.endsWith("/auth")) return json({ apiKey: "key" });
			if (path.includes("/items/")) return json(item);
			if (path.includes("page=1")) {
				return json({
					results: [wireAccount("account-1")],
					total: 2,
					totalPages: 2,
					page: 1,
				});
			}
			if (path.includes("page=2")) {
				return json({
					results: [wireAccount("account-2")],
					total: 2,
					totalPages: 2,
					page: 2,
				});
			}
			return json({ results: [wireTransaction()], next: null });
		});
		const client = new PluggyClient(
			{ clientId: "client", clientSecret: "secret" },
			"https://pluggy.test",
		);

		const accounts = await client.accounts(
			["provider-item"],
			"00000000-0000-4000-8000-000000000001",
		);
		expect(accounts.map(({ id }) => id)).toEqual(["account-1", "account-2"]);
		const [account] = accounts;
		if (!account) throw new Error("Expected a mapped account");
		const transactions = await client.transactions(account);
		expect(transactions[0]?.amountCents).toBe(-1234);
		expect(transactions[0]?.localDate).toBe("2026-08-01");
	});
});

describe("Pluggy API key cache", () => {
	test("reuses a cached key across client instances instead of re-authenticating", async () => {
		const { cache, store } = fakeCache();
		const authCalls = stubAuthAndItem();

		const cold = await newClient(cache).connection("provider-item");
		const warm = await newClient(cache).connection("provider-item");

		expect([cold.institution, warm.institution]).toEqual(["Test Bank", "Test Bank"]);

		expect(authCalls()).toBe(1);
		expect([...store.keys()]).toEqual([expect.stringMatching(/^pluggy:apikey:[\da-f]{32}$/u)]);
	});

	test("keys the cache per user and connection", async () => {
		const { cache, store } = fakeCache();
		const authCalls = stubAuthAndItem();

		await newClient(cache, { userId: "user-1", connectionId: "connection-1" }).connection(
			"provider-item",
		);
		await newClient(cache, { userId: "user-1", connectionId: "connection-2" }).connection(
			"provider-item",
		);

		expect(authCalls()).toBe(2);
		expect(store.size).toBe(2);
	});

	test("evicts the shared entry when the provider rejects the cached key", async () => {
		const { cache, store } = fakeCache();
		let authCalls = 0;
		let itemCalls = 0;
		stubFetch(async (url) => {
			if (url.endsWith("/auth")) {
				authCalls += 1;
				return json({ apiKey: `key-${authCalls}` });
			}
			itemCalls += 1;
			return itemCalls === 1 ? json({}, 401) : json(item);
		});

		await newClient(cache).connection("provider-item");

		expect(authCalls).toBe(2);
		expect([...store.values()]).toEqual(["key-2"]);
	});

	test("re-authenticates once when parallel calls all reject the same cached key", async () => {
		const { cache } = fakeCache();
		let authCalls = 0;
		const rejected = new Set<string>();
		stubFetch(async (url, init) => {
			if (url.endsWith("/auth")) {
				authCalls += 1;
				return json({ apiKey: `key-${authCalls}` });
			}
			const sent = new Headers(init?.headers).get("X-API-KEY") ?? "";
			if (sent !== "key-1") return json(item);
			rejected.add(url);
			return json({}, 401);
		});

		await newClient(cache).verify(["item-a", "item-b", "item-c"]);

		expect(rejected.size).toBe(3);
		expect(authCalls).toBe(2);
	});

	test("falls back to authenticating when the cache itself fails", async () => {
		const authCalls = stubAuthAndItem();
		const broken: PluggyTokenCache = {
			get: () => Promise.reject(new Error("kv down")),
			set: () => Promise.reject(new Error("kv down")),
			delete: () => Promise.reject(new Error("kv down")),
		};

		const connection = await newClient(broken).connection("provider-item");

		expect(connection.institution).toBe("Test Bank");
		expect(authCalls()).toBe(1);
	});
});

const fakeCache = () => {
	const store = new Map<string, string>();
	const ttls: number[] = [];
	const cache: PluggyTokenCache = {
		get: (key) => Promise.resolve(store.get(key) ?? null),
		set: (key, value, ttlSeconds) => {
			ttls.push(ttlSeconds);
			store.set(key, value);
			return Promise.resolve();
		},
		delete: (key) => {
			store.delete(key);
			return Promise.resolve();
		},
	};
	return { cache, store, ttls };
};

const newClient = (cache: PluggyTokenCache, cacheScope = DEFAULT_CACHE_SCOPE) =>
	new PluggyClient(
		{ clientId: "client", clientSecret: "secret" },
		"https://pluggy.test",
		cache,
		cacheScope,
	);

const stubAuthAndItem = () => {
	let authCalls = 0;
	stubFetch(async (url) => {
		if (url.endsWith("/auth")) {
			authCalls += 1;
			return json({ apiKey: `key-${authCalls}` });
		}
		return json(item);
	});
	return () => authCalls;
};

const wireAccount = (id: string) => ({
	id,
	itemId: "provider-item",
	type: "CREDIT",
	subtype: "CREDIT_CARD",
	name: "Card",
	marketingName: null,
	balance: 100,
	currencyCode: "BRL",
	creditData: {
		brand: "VISA",
		balanceCloseDate: null,
		balanceDueDate: null,
		availableCreditLimit: 900,
		creditLimit: 1000,
		disaggregatedCreditLimits: null,
	},
});

const wireTransaction = () => ({
	id: "transaction-1",
	accountId: "account-1",
	date: "2026-08-01T12:00:00.000Z",
	description: "Test purchase",
	amount: 12.34,
	amountInAccountCurrency: null,
	currencyCode: "BRL",
	categoryId: null,
	creditCardMetadata: null,
	paymentData: null,
});
