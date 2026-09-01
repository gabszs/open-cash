import { afterEach, describe, expect, test } from "bun:test";

import type { PluggyTokenCache } from "../../../../src/features/finance/pluggy/tokenCache";
import type { FinanceRepository } from "../../../../src/features/finance/repository";

import { tokenCacheKey } from "../../../../src/features/finance/pluggy/tokenCache";
import { FinanceService } from "../../../../src/features/finance/service";
import { seal } from "../../../../src/lib/secrets";

/* oxlint-disable eslint/no-use-before-define -- The cache fixture stays below the behavioral test. */

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("FinanceService direct Pluggy reads", () => {
	test("reads accounts and transactions from Pluggy without a D1 mirror", async () => {
		const userId = "user-1";
		const connectionId = "00000000-0000-4000-8000-000000000001";
		const encryptionKey = "finance-encryption-key";
		const cache = fakeCache();
		let authCalls = 0;
		globalThis.fetch = (async (request: string | URL | Request) => {
			const url = String(request);
			if (url.endsWith("/auth")) {
				authCalls += 1;
				return Response.json({ apiKey: "provider-api-key" });
			}
			if (url.includes("/items/")) {
				return Response.json({
					id: "item-1",
					connector: { name: "Test Bank" },
					status: "UPDATED",
					executionStatus: null,
					lastUpdatedAt: "2026-08-09T12:00:00.000Z",
				});
			}
			if (url.includes("/accounts?")) {
				return Response.json({
					results: [
						{
							id: "account-1",
							itemId: "item-1",
							type: "BANK",
							subtype: "CHECKING_ACCOUNT",
							name: "Checking",
							marketingName: null,
							balance: 100,
							currencyCode: "BRL",
							creditData: null,
						},
					],
					totalPages: 1,
					page: 1,
					total: 1,
				});
			}
			if (url.includes("/v2/transactions")) {
				return Response.json({
					results: [
						{
							id: "transaction-1",
							accountId: "account-1",
							date: "2026-08-08T12:00:00.000Z",
							description: "Salary",
							amount: 250,
							amountInAccountCurrency: null,
							currencyCode: "BRL",
							categoryId: "01000000",
							creditCardMetadata: null,
							paymentData: null,
						},
					],
					next: null,
				});
			}
			throw new Error(`Unexpected Pluggy request: ${url}`);
		}) as typeof fetch;

		const sealedClientSecret = await seal("client-secret", encryptionKey);
		const repository = {
			listScopedConnections: () =>
				Promise.resolve([
					{
						id: connectionId,
						userId,
						name: "Test connection",
						provider: "pluggy",
						clientId: "client-id",
						sealedClientSecret,
						itemIds: ["item-1"],
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				]),
			getConnection: () =>
				Promise.resolve({
					id: connectionId,
					userId,
					name: "Test connection",
					provider: "pluggy",
					clientId: "client-id",
					sealedClientSecret,
					itemIds: ["item-1"],
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
			connectionScope: connectionId,
		} as unknown as FinanceRepository;
		const service = new FinanceService(repository, encryptionKey, cache.adapter);

		const result = await service.listTransactions(userId, {
			startDate: "2026-08-01",
			endDate: "2026-08-09",
			limit: 100,
		});

		expect(result.transactions).toEqual([
			expect.objectContaining({
				id: "transaction-1",
				accountId: "account-1",
				occurredAt: "2026-08-08T12:00:00.000Z",
				description: "Salary",
				amount: "250.00",
				currency: "BRL",
				category: "01000000",
				categorySrc: "pluggy",
			}),
		]);
		const details = await service.getTransactionDetails(userId, ["transaction-1"]);
		expect(details.transactions[0]).toMatchObject({
			id: "transaction-1",
			accountId: "account-1",
			occurredAt: "2026-08-08T12:00:00.000Z",
		});
		expect(authCalls).toBe(1);
		expect([...cache.store.keys()]).toEqual([await tokenCacheKey({ userId, connectionId })]);
	});

	test("filters selected accounts and returns exact daily totals without transfers", async () => {
		const userId = "user-1";
		const connectionId = "00000000-0000-4000-8000-000000000001";
		const encryptionKey = "finance-encryption-key";
		const cache = fakeCache();
		const requestedAccountIds: string[] = [];
		globalThis.fetch = (async (request: string | URL | Request) => {
			const url = new URL(String(request));
			if (url.pathname.endsWith("/auth")) {
				return Response.json({ apiKey: "provider-api-key" });
			}
			if (url.pathname.includes("/items/")) {
				return Response.json({
					id: "item-1",
					connector: { name: "Test Bank" },
					status: "UPDATED",
					executionStatus: null,
					lastUpdatedAt: "2026-08-09T12:00:00.000Z",
				});
			}
			if (url.pathname.endsWith("/accounts")) {
				return Response.json({
					results: [
						providerAccount("account-1", "Checking"),
						providerAccount("account-2", "Savings"),
					],
					totalPages: 1,
					page: 1,
					total: 2,
				});
			}
			if (url.pathname.endsWith("/v2/transactions")) {
				const accountId = url.searchParams.get("accountId");
				if (accountId) requestedAccountIds.push(accountId);
				return Response.json({
					results:
						accountId === "account-1"
							? [
									providerTransaction("income-1", "2026-08-09", 250, "01000000"),
									providerTransaction(
										"transfer-1",
										"2026-08-09",
										-50,
										"04000000",
									),
									providerTransaction(
										"expense-1",
										"2026-08-08",
										-40,
										"17000000",
										"Café Central",
									),
								]
							: [providerTransaction("other-account", "2026-08-07", 900, "01000000")],
					next: null,
				});
			}
			throw new Error(`Unexpected Pluggy request: ${url}`);
		}) as typeof fetch;

		const service = await financeServiceFixture(
			userId,
			connectionId,
			encryptionKey,
			cache.adapter,
		);
		const filter = {
			accountIds: ["account-1"],
			startDate: "2026-08-01",
			endDate: "2026-08-09",
		};
		const page = await service.listTransactions(userId, { ...filter, limit: 2 });
		const summary = await service.getTransactions(userId, filter);

		expect(page.transactions.map(({ id }) => id)).toEqual(["transfer-1", "income-1"]);
		expect(requestedAccountIds).toEqual(["account-1", "account-1"]);
		expect(page.cursor).toBeDefined();
		expect(summary).toMatchObject({
			accountsCovered: 1,
			received: "250.00",
			spent: "40.00",
			days: [
				{ date: "2026-08-09", received: "250.00", spent: "0.00", count: 2 },
				{ date: "2026-08-08", received: "0.00", spent: "40.00", count: 1 },
			],
		});

		await expect(
			service.listTransactions(userId, {
				...filter,
				accountIds: ["account-2"],
				cursor: page.cursor,
				limit: 2,
			}),
		).rejects.toThrow("FINANCE_INVALID_CURSOR");

		const searched = await service.listTransactions(userId, {
			...filter,
			limit: 100,
			search: "  cafe central ",
		});
		expect(searched.transactions.map(({ id }) => id)).toEqual(["expense-1"]);
		await expect(
			service.listTransactions(userId, {
				...filter,
				cursor: page.cursor,
				limit: 2,
				search: "income",
			}),
		).rejects.toThrow("FINANCE_INVALID_CURSOR");
	});
});

const providerAccount = (id: string, name: string) => ({
	id,
	itemId: "item-1",
	type: "BANK",
	subtype: "CHECKING_ACCOUNT",
	name,
	marketingName: null,
	balance: 100,
	currencyCode: "BRL",
	creditData: null,
});

const providerTransaction = (
	id: string,
	date: string,
	amount: number,
	categoryId: string,
	description = id,
) => ({
	id,
	accountId: "provider-account",
	date: `${date}T12:00:00.000Z`,
	description,
	amount,
	amountInAccountCurrency: null,
	currencyCode: "BRL",
	categoryId,
	creditCardMetadata: null,
	paymentData: null,
});

const financeServiceFixture = async (
	userId: string,
	connectionId: string,
	encryptionKey: string,
	cache: PluggyTokenCache,
) => {
	const sealedClientSecret = await seal("client-secret", encryptionKey);
	const connection = {
		id: connectionId,
		userId,
		name: "Test connection",
		provider: "pluggy",
		clientId: "client-id",
		sealedClientSecret,
		itemIds: ["item-1"],
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	const repository = {
		listScopedConnections: () => Promise.resolve([connection]),
		getConnection: () => Promise.resolve(connection),
		connectionScope: connectionId,
	} as unknown as FinanceRepository;
	return new FinanceService(repository, encryptionKey, cache);
};

const fakeCache = () => {
	const store = new Map<string, string>();
	const adapter: PluggyTokenCache = {
		get: (key) => Promise.resolve(store.get(key) ?? null),
		set: (key, value) => {
			store.set(key, value);
			return Promise.resolve();
		},
		delete: (key) => {
			store.delete(key);
			return Promise.resolve();
		},
	};
	return { adapter, store };
};
