import { z } from "zod";

import type {
	FinanceAccount,
	FinanceTransaction,
	ProviderBill,
	ProviderConnection,
	ProviderConsent,
	ProviderInvestment,
} from "../common/domain";
import type { PluggyTokenCache, PluggyTokenCacheScope } from "./tokenCache";

import { normalizeDescription, toCents } from "../common/domain";
import { tokenCacheKey, tokenTtlSeconds } from "./tokenCache";

/* oxlint-disable no-await-in-loop -- Provider retries and cursor pagination are sequential by contract. */

export interface PluggyCredentials {
	clientId: string;
	clientSecret: string;
}

// oxlint-disable-next-line eslint/arrow-body-style -- Keeps the Web Promise suppression adjacent to its constructor.
const delay = (milliseconds: number): Promise<void> => {
	// oxlint-disable-next-line promise/avoid-new -- Web-compatible timer used by bounded provider retries.
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
};

/** The token cache is an optimization: any failure degrades to a miss, never to a failed call. */
const optional = async <T>(operation: () => Promise<T>): Promise<T | null> => {
	try {
		return await operation();
	} catch {
		return null;
	}
};

const authSchema = z.object({ apiKey: z.string().min(1) });
const itemSchema = z.object({
	id: z.string().min(1),
	connector: z.object({ name: z.string() }),
	status: z.string(),
	executionStatus: z.string().nullish(),
	lastUpdatedAt: z.string().nullable(),
	parameter: z.object({ label: z.string() }).nullish(),
	statusDetail: z
		.record(
			z.string(),
			z.object({ warnings: z.array(z.object({ message: z.string() })).nullish() }).nullish(),
		)
		.nullish()
		.catch(null),
	consecutiveFailedLoginAttempts: z.number().int().nullish(),
});
const consentSchema = z.object({
	expiresAt: z.string().nullish(),
	revokedAt: z.string().nullish(),
	products: z.array(z.string()).nullish(),
});
const accountSchema = z.object({
	id: z.string().min(1),
	itemId: z.string().min(1),
	type: z.string(),
	subtype: z.string().nullish(),
	name: z.string(),
	marketingName: z.string().nullish(),
	balance: z.number(),
	currencyCode: z.string(),
	creditData: z
		.object({
			brand: z.string().nullish(),
			balanceCloseDate: z.string().nullish(),
			balanceDueDate: z.string().nullish(),
			availableCreditLimit: z.number().nullish(),
			creditLimit: z.number().nullish(),
			disaggregatedCreditLimits: z
				.array(
					z.object({
						creditLineLimitType: z.string().nullish(),
						customizedLimitAmount: z.number().nullish(),
					}),
				)
				.nullish(),
		})
		.nullish(),
});
const transactionSchema = z.object({
	id: z.string().min(1),
	accountId: z.string().min(1),
	date: z.string(),
	description: z.string(),
	amount: z.number(),
	amountInAccountCurrency: z.number().nullish(),
	currencyCode: z.string().nullish(),
	categoryId: z.string().nullish(),
	creditCardMetadata: z
		.object({
			billId: z.string().optional(),
			installmentNumber: z.number().optional(),
			totalInstallments: z.number().optional(),
			payeeMCC: z.number().optional(),
			purchaseDate: z.string().optional(),
			billForecastDate: z.string().optional(),
		})
		.nullish(),
	paymentData: z
		.object({
			receiver: z
				.object({
					name: z.string().nullish(),
					documentNumber: z.object({ value: z.string().optional() }).optional(),
				})
				.nullish(),
			paymentMethod: z.string().nullish(),
		})
		.nullish(),
});
const billSchema = z.object({
	id: z.string().min(1),
	billClosingDate: z.string().nullish(),
	dueDate: z.string(),
	totalAmount: z.number(),
	totalAmountCurrencyCode: z.string().nullish(),
	minimumPaymentAmount: z.number().nullish(),
	financeCharges: z.array(z.object({ amount: z.number() })),
	payments: z.array(z.object({ amount: z.number() })),
});
const investmentSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	balance: z.number(),
	currencyCode: z.string(),
	type: z.string(),
	subtype: z.string().nullish(),
	quantity: z.number().nullish(),
	amount: z.number().nullish(),
	status: z.string().nullish(),
});
const page = <T extends z.ZodType>(row: T) =>
	z.object({
		results: z.array(row),
		totalPages: z.number().int().positive(),
		page: z.number().int().positive(),
		total: z.number().int().nonnegative(),
	});
const transactionPageSchema = z.object({
	results: z.array(transactionSchema),
	next: z.string().nullable(),
});
const apiErrorSchema = z.object({
	codeDescription: z.string().nullish(),
	message: z.string().nullish(),
});

type WireAccount = z.infer<typeof accountSchema>;

export class PluggyClient {
	private apiKey: string | null = null;
	private refreshing: Promise<string> | null = null;
	private refreshingForced = false;
	private cacheKey: Promise<string> | null = null;
	private readonly credentials: PluggyCredentials;
	private readonly baseUrl: string;
	private readonly cache: PluggyTokenCache | null;
	private readonly cacheScope: PluggyTokenCacheScope | null;

	constructor(
		credentials: PluggyCredentials,
		baseUrl = "https://api.pluggy.ai",
		cache?: PluggyTokenCache,
		cacheScope?: PluggyTokenCacheScope,
	) {
		this.credentials = credentials;
		this.baseUrl = baseUrl;
		this.cache = cache && cacheScope ? cache : null;
		this.cacheScope = cacheScope ?? null;
	}

	async verify(itemIds: string[]) {
		await this.key();
		await Promise.all(itemIds.map((id) => this.connection(id)));
	}

	async connection(itemId: string): Promise<ProviderConnection> {
		const item = itemSchema.parse(await this.get(`/items/${encodeURIComponent(itemId)}`));
		return {
			id: item.id,
			institution: item.connector.name,
			status: item.status,
			executionStatus: item.executionStatus ?? null,
			lastUpdatedAt: item.lastUpdatedAt ? new Date(item.lastUpdatedAt) : null,
			parameter: item.parameter?.label ?? null,
			warnings: Object.entries(item.statusDetail ?? {}).flatMap(([product, detail]) =>
				(detail?.warnings ?? []).map((warning) => `${product}: ${warning.message}`),
			),
			failedLogins: item.consecutiveFailedLoginAttempts ?? null,
		};
	}

	async consent(itemId: string): Promise<ProviderConsent | null> {
		const response = page(consentSchema).parse(
			await this.get(`/consents?itemId=${encodeURIComponent(itemId)}&pageSize=500&page=1`),
		);
		const [consent] = response.results;
		if (!consent) return null;
		return {
			expiresAt: consent.expiresAt ? new Date(consent.expiresAt) : null,
			revokedAt: consent.revokedAt ? new Date(consent.revokedAt) : null,
			products: consent.products ?? [],
		};
	}

	async accounts(itemIds: string[], connectionId: string): Promise<FinanceAccount[]> {
		const groups = await Promise.all(
			itemIds.map(async (itemId) => {
				const connection = await this.connection(itemId);
				const rows = await this.offsetPages(
					`/accounts?itemId=${encodeURIComponent(itemId)}`,
					accountSchema,
				);
				return rows.map((row) => this.mapAccount(row, connection, connectionId));
			}),
		);
		return groups.flat();
	}

	async account(accountId: string, connectionId: string): Promise<FinanceAccount> {
		const row = accountSchema.parse(
			await this.get(`/accounts/${encodeURIComponent(accountId)}`),
		);
		const connection = await this.connection(row.itemId);
		return this.mapAccount(row, connection, connectionId);
	}

	async transactions(account: FinanceAccount): Promise<FinanceTransaction[]> {
		const rows: FinanceTransaction[] = [];
		const seen = new Set<string>();
		let query = `?accountId=${encodeURIComponent(account.id)}`;
		for (let hop = 0; hop < 500; hop += 1) {
			// oxlint-disable-next-line no-await-in-loop -- Pluggy cursor pagination is sequential.
			const result = transactionPageSchema.parse(await this.get(`/v2/transactions${query}`));
			for (const row of result.results) {
				if (seen.has(row.id)) throw new Error("PLUGGY_BAD_RESPONSE");
				seen.add(row.id);
				rows.push(this.mapTransaction(row, account));
			}
			if (!result.next) return rows;
			if (result.next === query) throw new Error("PLUGGY_BAD_RESPONSE");
			query = result.next;
		}
		throw new Error("PLUGGY_BAD_RESPONSE");
	}

	async bills(account: FinanceAccount): Promise<ProviderBill[]> {
		const rows = await this.offsetPages(
			`/bills?accountId=${encodeURIComponent(account.id)}`,
			billSchema,
		);
		return rows
			.map((bill) => ({
				id: bill.id,
				closingDate: bill.billClosingDate ? bill.billClosingDate.slice(0, 10) : null,
				dueDate: bill.dueDate.slice(0, 10),
				totalCents: toCents(bill.totalAmount),
				currency: bill.totalAmountCurrencyCode ?? account.currency,
				minimumPaymentCents:
					bill.minimumPaymentAmount === null || bill.minimumPaymentAmount === undefined
						? null
						: toCents(bill.minimumPaymentAmount),
				financeChargesCents: bill.financeCharges.reduce(
					(sum, value) => sum + toCents(value.amount),
					0,
				),
				paymentsCents: bill.payments.reduce((sum, value) => sum + toCents(value.amount), 0),
				paymentCount: bill.payments.length,
			}))
			.toSorted((left, right) =>
				(right.closingDate ?? right.dueDate).localeCompare(
					left.closingDate ?? left.dueDate,
				),
			);
	}

	async investments(itemId: string, connectionId: string): Promise<ProviderInvestment[]> {
		const connection = await this.connection(itemId);
		const rows = await this.offsetPages(
			`/investments?itemId=${encodeURIComponent(itemId)}`,
			investmentSchema,
		);
		return rows
			.filter(
				(row) =>
					!(row.status === "TOTAL_WITHDRAWAL" && row.balance === 0 && row.amount === 0),
			)
			.map((row) => ({
				id: row.id,
				connectionId,
				institution: connection.institution,
				name: row.name,
				type: row.type,
				subtype: row.subtype ?? null,
				balanceCents: toCents(row.balance),
				currency: row.currencyCode,
				quantity:
					row.quantity === null || row.quantity === undefined
						? null
						: String(row.quantity),
			}));
	}

	private async key(force = false): Promise<string> {
		if (!force && this.apiKey) return this.apiKey;
		if (force) {
			this.apiKey = null;
			// Join another refresh, but never a plain resolution: it settles to the dead token.
			if (!this.refreshingForced) this.refreshing = null;
		}
		this.refreshing ??= this.startResolve(force);
		return this.refreshing;
	}

	/** Parallel provider calls that all hit the same 401 share a single re-authentication. */
	private startResolve(force: boolean) {
		this.refreshingForced = force;
		return this.resolveKey(force).finally(() => {
			this.refreshing = null;
			this.refreshingForced = false;
		});
	}

	/** Memory first, then the shared cache, and only then the slow `POST /auth`. */
	private async resolveKey(force: boolean): Promise<string> {
		const { cache } = this;
		if (!cache || !this.cacheScope) return this.authenticate();
		this.cacheKey ??= tokenCacheKey(this.cacheScope);
		const cacheKey = await this.cacheKey;
		if (force) {
			// A 401 means the cached token is dead for every isolate, not just this one.
			await optional(() => cache.delete(cacheKey));
		} else {
			const cached = await optional(() => cache.get(cacheKey));
			if (cached) {
				this.apiKey = cached;
				return cached;
			}
		}
		const apiKey = await this.authenticate();
		await optional(() => cache.set(cacheKey, apiKey, tokenTtlSeconds(apiKey)));
		return apiKey;
	}

	private async authenticate() {
		const response = await fetch(`${this.baseUrl}/auth`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(this.credentials),
		});
		if (!response.ok) throw new Error("PLUGGY_AUTH_FAILED");
		this.apiKey = authSchema.parse(await response.json()).apiKey;
		return this.apiKey;
	}

	private async get(path: string): Promise<unknown> {
		let response = await fetch(`${this.baseUrl}${path}`, {
			headers: { "X-API-KEY": await this.key() },
		});
		if (response.status === 401) {
			this.apiKey = null;
			response = await fetch(`${this.baseUrl}${path}`, {
				headers: { "X-API-KEY": await this.key(true) },
			});
		}
		for (let retry = 0; retry < 2 && response.status === 429; retry += 1) {
			const seconds = Number(response.headers.get("retry-after") ?? "1");
			await delay(Math.max(1, seconds) * 1000);
			// oxlint-disable-next-line no-await-in-loop -- bounded provider retry is sequential.
			response = await fetch(`${this.baseUrl}${path}`, {
				headers: { "X-API-KEY": await this.key() },
			});
		}
		if (!response.ok) {
			const body = apiErrorSchema.safeParse(await response.json().catch(() => ({})));
			const code = body.success ? body.data.codeDescription : null;
			if (code?.includes("CONSENT")) throw new Error("PLUGGY_CONSENT_REVOKED");
			if (response.status === 404) throw new Error("FINANCE_RESOURCE_NOT_FOUND");
			if (response.status === 429) throw new Error("TOO_MANY_REQUESTS");
			throw new Error("PLUGGY_UNAVAILABLE");
		}
		return response.json();
	}

	private async offsetPages<T>(path: string, schema: z.ZodType<T>): Promise<T[]> {
		const separator = path.includes("?") ? "&" : "?";
		const first = page(schema).parse(await this.get(`${path}${separator}pageSize=500&page=1`));
		const rest = await Promise.all(
			Array.from({ length: first.totalPages - 1 }, (_, index) =>
				this.get(`${path}${separator}pageSize=500&page=${index + 2}`).then((value) =>
					page(schema).parse(value),
				),
			),
		);
		return [first, ...rest].flatMap((value) => value.results);
	}

	private mapAccount(
		row: WireAccount,
		source: ProviderConnection,
		connectionId: string,
	): FinanceAccount {
		if (row.type !== "BANK" && row.type !== "CREDIT") throw new Error("PLUGGY_BAD_RESPONSE");
		const totalLimit = row.creditData?.disaggregatedCreditLimits?.find(
			(line) => line.creditLineLimitType === "LIMITE_CREDITO_TOTAL",
		)?.customizedLimitAmount;
		return {
			id: row.id,
			connectionId,
			providerConnectionId: row.itemId,
			institution: source.institution,
			name: row.marketingName ?? row.name,
			type: row.type,
			subtype: row.subtype ?? null,
			amountCents: toCents(row.balance),
			currency: row.currencyCode,
			lastUpdatedAt: source.lastUpdatedAt,
			credit:
				row.type === "CREDIT" && row.creditData
					? {
							limitCents:
								totalLimit === undefined && row.creditData.creditLimit === null
									? null
									: toCents(totalLimit ?? row.creditData.creditLimit ?? 0),
							availableLimitCents:
								row.creditData.availableCreditLimit === null ||
								row.creditData.availableCreditLimit === undefined
									? null
									: toCents(row.creditData.availableCreditLimit),
							balanceCloseDate: row.creditData.balanceCloseDate ?? null,
							balanceDueDate: row.creditData.balanceDueDate ?? null,
							brand: row.creditData.brand ?? null,
						}
					: null,
		};
	}

	// oxlint-disable-next-line eslint/complexity -- the mapper intentionally keeps all wire-to-domain fields together.
	private mapTransaction(
		row: z.infer<typeof transactionSchema>,
		account: FinanceAccount,
	): FinanceTransaction {
		const sign = account.type === "CREDIT" ? -1 : 1;
		const metadata = row.creditCardMetadata;
		const receiver = row.paymentData?.receiver;
		const document = receiver?.documentNumber?.value?.replaceAll(/\D/gu, "") || null;
		return {
			id: row.id,
			connectionId: account.connectionId,
			accountId: account.id,
			accountType: account.type,
			accountSubtype: account.subtype,
			occurredAt: row.date,
			localDate: new Intl.DateTimeFormat("en-CA", {
				timeZone: "America/Sao_Paulo",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			}).format(new Date(row.date)),
			amountCents: sign * toCents(row.amountInAccountCurrency ?? row.amount),
			currency: account.currency,
			originalAmountCents:
				row.amountInAccountCurrency === null || row.amountInAccountCurrency === undefined
					? null
					: sign * toCents(row.amount),
			originalCurrency:
				row.amountInAccountCurrency === null || row.amountInAccountCurrency === undefined
					? null
					: (row.currencyCode ?? null),
			description: row.description,
			descriptionNorm: normalizeDescription(row.description),
			categoryId: row.categoryId ?? null,
			document,
			counterpartyName: receiver?.name ?? null,
			paymentMethod: row.paymentData?.paymentMethod ?? null,
			mcc:
				metadata?.payeeMCC === null || metadata?.payeeMCC === undefined
					? null
					: String(metadata.payeeMCC),
			billId: metadata?.billId ?? null,
			billForecastDate: metadata?.billForecastDate ?? null,
			instalmentNumber: metadata?.installmentNumber ?? null,
			instalmentTotal: metadata?.totalInstallments ?? null,
			purchaseDate: metadata?.purchaseDate ?? null,
			category: row.categoryId ?? null,
			categorySrc: row.categoryId ? "pluggy" : "none",
		};
	}
}
