import type { Connection } from "@server/db/models";

import { unseal } from "@server/lib/secrets";

import type { FinanceAccount, FinanceTransaction, ProviderInvestment } from "./common/domain";
import type { PluggyCredentials } from "./pluggy/client";
import type { PluggyTokenCache, PluggyTokenCacheScope } from "./pluggy/tokenCache";
import type { FinanceRepository } from "./repository";
import type { InvestmentsInput, ListTransactionsInput, TransactionFilters } from "./schemas";

import { decodeCursor, encodeCursor, toDecimal, transactionCursorFilter } from "./common/domain";
import { PluggyClient } from "./pluggy/client";

/* oxlint-disable eslint/no-use-before-define, eslint/no-await-in-loop, unicorn/no-await-expression-member, eslint/no-nested-ternary, unicorn/no-nested-ternary, eslint/no-shadow, typescript/no-non-null-assertion, eslint/no-negated-condition, unicorn/no-negated-condition -- Orchestration preserves provider ordering and assembles transport-neutral domain responses. */

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
	"01000000": "Renda",
	"02000000": "Empréstimos e financiamento",
	"03000000": "Investimentos",
	"04000000": "Transferência mesma titularidade",
	"05000000": "Transferências",
	"06000000": "Obrigações legais",
	"07000000": "Serviços",
	"08000000": "Compras",
	"09000000": "Serviços digitais",
	"10000000": "Supermercado",
	"11000000": "Alimentos e bebidas",
	"12000000": "Viagens",
	"13000000": "Doações",
	"14000000": "Apostas",
	"15000000": "Impostos",
	"16000000": "Taxas bancárias",
	"17000000": "Moradia",
	"18000000": "Saúde",
	"19000000": "Transporte",
	"20000000": "Seguros",
	"21000000": "Lazer",
	"99999999": "Outros",
};

const formatAccount = (account: FinanceAccount) => ({
	id: account.id,
	connectionId: account.connectionId,
	institution: account.institution,
	name: account.name,
	type: account.type,
	subtype: account.subtype,
	...(account.type === "CREDIT"
		? { usedCredit: toDecimal(account.amountCents) }
		: { balance: toDecimal(account.amountCents) }),
	currency: account.currency,
	lastUpdatedAt: account.lastUpdatedAt?.toISOString() ?? null,
	credit: account.credit
		? {
				limit:
					account.credit.limitCents === null
						? null
						: toDecimal(account.credit.limitCents),
				availableLimit:
					account.credit.availableLimitCents === null
						? null
						: toDecimal(account.credit.availableLimitCents),
				balanceCloseDate: account.credit.balanceCloseDate
					? new Date(account.credit.balanceCloseDate).toISOString()
					: null,
				balanceDueDate: account.credit.balanceDueDate
					? new Date(account.credit.balanceDueDate).toISOString()
					: null,
				brand: account.credit.brand,
			}
		: null,
});

const formatTransaction = (row: FinanceTransaction, details = false) => ({
	id: row.id,
	accountId: row.accountId,
	...(details
		? {
				accountType: row.accountType,
				accountSubtype: row.accountSubtype,
			}
		: {}),
	date: row.localDate,
	...(details ? { occurredAt: row.occurredAt } : {}),
	description: row.description,
	descriptionNorm: row.descriptionNorm,
	amount: toDecimal(row.amountCents),
	currency: row.currency,
	...(details && row.originalAmountCents !== null && row.originalCurrency
		? {
				original: {
					amount: toDecimal(row.originalAmountCents),
					currency: row.originalCurrency,
				},
			}
		: {}),
	category: row.category,
	categorySrc: row.categorySrc,
	...(row.counterpartyName || (details && row.document)
		? {
				counterparty: {
					...(details && row.document ? { document: row.document } : {}),
					...(row.counterpartyName ? { name: row.counterpartyName } : {}),
				},
			}
		: {}),
	...(details
		? {
				categoryId: row.categoryId,
				paymentMethod: row.paymentMethod,
				...(row.instalmentNumber !== null || row.instalmentTotal !== null
					? {
							instalment: {
								...(row.instalmentNumber === null
									? {}
									: { number: row.instalmentNumber }),
								...(row.instalmentTotal === null
									? {}
									: { total: row.instalmentTotal }),
							},
						}
					: {}),
				purchaseDate: row.purchaseDate,
				mcc: row.mcc,
				billId: row.billId,
			}
		: {}),
});

const normalizeTransactionSearch = (value: string) =>
	value
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLocaleUpperCase("pt-BR")
		.replaceAll(/\s+/gu, " ")
		.trim();

export class FinanceService {
	private readonly repository: FinanceRepository;
	private readonly encryptionKey: string;
	private readonly tokenCache: PluggyTokenCache | undefined;

	constructor(
		repository: FinanceRepository,
		encryptionKey: string,
		tokenCache?: PluggyTokenCache,
	) {
		this.repository = repository;
		this.encryptionKey = encryptionKey;
		this.tokenCache = tokenCache;
	}

	/** Every owned provider call goes through here so it shares the scoped API key. */
	private pluggy(credentials: PluggyCredentials, cacheScope?: PluggyTokenCacheScope) {
		return new PluggyClient(credentials, undefined, this.tokenCache, cacheScope);
	}

	async getAccounts(userId: string) {
		const { accounts, unavailable } = await this.loadAccounts(userId);
		return {
			accounts: accounts.map(formatAccount),
			unavailable,
		};
	}

	async getBalanceByAccount(userId: string, accountId: string) {
		const account = await this.assertOwnedAccount(userId, accountId);
		return formatAccount(account);
	}

	async getBalance(userId: string) {
		const loaded = await this.loadAccounts(userId);
		if (loaded.unavailable.length > 0) throw new Error("PLUGGY_UNAVAILABLE");
		const { accounts } = loaded;
		const currencies = [...new Set(accounts.map((account) => account.currency))];
		if (currencies.length > 1) throw new Error("FINANCE_MIXED_CURRENCIES");
		const sum = (type: FinanceAccount["type"]) =>
			accounts
				.filter((row) => row.type === type)
				.reduce((total, row) => total + row.amountCents, 0);
		const asOf = [...new Map(accounts.map((row) => [row.connectionId, row])).values()].map(
			(row) => ({
				connectionId: row.connectionId,
				lastUpdatedAt: row.lastUpdatedAt?.toISOString() ?? null,
			}),
		);
		return {
			cash: toDecimal(sum("BANK")),
			creditUsed: toDecimal(sum("CREDIT")),
			...(accounts.some((row) => row.type === "INVESTMENT")
				? { invested: toDecimal(sum("INVESTMENT")) }
				: {}),
			...(accounts.some((row) => row.type === "LOAN")
				? { loans: toDecimal(sum("LOAN")) }
				: {}),
			currency: currencies[0] ?? "BRL",
			accountsCounted: accounts.length,
			asOf,
		};
	}

	async getTransactions(userId: string, input: TransactionFilters) {
		const { rows, accounts, allTransactions } = await this.filteredTransactions(userId, input);
		const currencies = [...new Set(rows.map((row) => row.currency))];
		if (currencies.length > 1) throw new Error("FINANCE_MIXED_CURRENCIES");
		const today = new Date().toISOString().slice(0, 10);
		const current = rows.filter((row) => row.localDate <= today);
		const spent = current
			.filter((row) => row.amountCents < 0 && !isTransfer(row))
			.reduce((sum, row) => sum - row.amountCents, 0);
		const received = current
			.filter((row) => row.amountCents > 0 && !isTransfer(row))
			.reduce((sum, row) => sum + row.amountCents, 0);
		const upcomingRows = rows.filter((row) => row.localDate > today);
		const upcoming = upcomingRows.reduce((sum, row) => sum + Math.abs(row.amountCents), 0);
		const grouped = new Map<string, FinanceTransaction[]>();
		for (const row of rows) {
			grouped.set(row.category ?? "none", [
				...(grouped.get(row.category ?? "none") ?? []),
				row,
			]);
		}
		const daily = new Map<string, { received: number; spent: number; count: number }>();
		for (const row of current) {
			const totals = daily.get(row.localDate) ?? { received: 0, spent: 0, count: 0 };
			totals.count += 1;
			if (!isTransfer(row) && row.amountCents > 0) totals.received += row.amountCents;
			if (!isTransfer(row) && row.amountCents < 0) totals.spent -= row.amountCents;
			daily.set(row.localDate, totals);
		}
		return {
			from: input.startDate,
			to: input.endDate,
			spent: toDecimal(spent),
			received: toDecimal(received),
			...(upcomingRows.length > 0
				? { upcoming: { total: toDecimal(upcoming), count: upcomingRows.length } }
				: {}),
			currency: currencies[0] ?? "BRL",
			days: [...daily]
				.toSorted(([left], [right]) => right.localeCompare(left))
				.map(([date, totals]) => ({
					date,
					received: toDecimal(totals.received),
					spent: toDecimal(totals.spent),
					count: totals.count,
				})),
			groups: [...grouped].map(([category, group]) => ({
				category: category === "none" ? null : category,
				label:
					category === "none" ? "Uncategorized" : (CATEGORY_LABELS[category] ?? category),
				total: toDecimal(group.reduce((sum, row) => sum + row.amountCents, 0)),
				count: group.length,
				sampleIds: group.slice(0, 10).map((row) => row.id),
			})),
			accountsCovered: accounts.length,
			dataThrough: dataThrough(accounts, allTransactions),
		};
	}

	async listTransactions(userId: string, input: ListTransactionsInput) {
		const filter = transactionCursorFilter(input, this.repository.connectionScope ?? null);
		const after = input.cursor
			? decodeCursor<{ localDate: string; id: string }>(input.cursor, filter)
			: null;
		let { rows } = await this.filteredTransactions(userId, input);
		if (after) {
			rows = rows.filter(
				(row) =>
					row.localDate < after.localDate ||
					(row.localDate === after.localDate && row.id < after.id),
			);
		}
		const page = rows.slice(0, input.limit);
		const last = page.at(-1);
		return {
			transactions: page.map((row) => formatTransaction(row, true)),
			...(rows.length > input.limit && last
				? { cursor: encodeCursor(filter, { localDate: last.localDate, id: last.id }) }
				: {}),
		};
	}

	async getTransactionDetails(userId: string, ids: readonly string[]) {
		const loaded = await this.loadFinanceData(userId);
		this.assertAvailable(loaded.unavailable);
		const selected = new Set(ids);
		const rows = loaded.transactions.filter((row) => selected.has(row.id));
		const found = new Set(rows.map((row) => row.id));
		if (ids.some((id) => !found.has(id))) throw new Error("FINANCE_TRANSACTION_NOT_FOUND");
		const byId = new Map(rows.map((row) => [row.id, row]));
		return { transactions: ids.map((id) => formatTransaction(byId.get(id)!, true)) };
	}

	async getBills(userId: string, accountId: string, limit = 12) {
		const account = await this.assertOwnedAccount(userId, accountId, "CREDIT");
		const { client } = await this.client(
			await this.requiredConnection(account.connectionId, userId),
			userId,
		);
		return {
			bills: (await client.bills(account)).slice(0, limit).map((bill) => ({
				id: bill.id,
				closingDate: bill.closingDate,
				dueDate: bill.dueDate,
				total: toDecimal(bill.totalCents),
				currency: bill.currency,
				minimumPayment:
					bill.minimumPaymentCents === null ? null : toDecimal(bill.minimumPaymentCents),
				financeCharges: toDecimal(bill.financeChargesCents),
				payments: toDecimal(bill.paymentsCents),
				paymentCount: bill.paymentCount,
			})),
		};
	}

	// oxlint-disable-next-line eslint/complexity -- The bill response keeps all provenance-sensitive figures in one derivation.
	async getBillSummary(userId: string, accountId: string) {
		const account = await this.assertOwnedAccount(userId, accountId, "CREDIT");
		const { client } = await this.client(
			await this.requiredConnection(account.connectionId, userId),
			userId,
		);
		const rows = await client.transactions(account);
		const base = {
			accountId,
			institution: account.institution,
			currency: account.currency,
			utilization: toDecimal(account.amountCents),
			creditLimit:
				account.credit?.limitCents === null || account.credit?.limitCents === undefined
					? null
					: toDecimal(account.credit.limitCents),
			availableLimit:
				account.credit?.availableLimitCents === null ||
				account.credit?.availableLimitCents === undefined
					? null
					: toDecimal(account.credit.availableLimitCents),
		};
		if (rows.length === 0) {
			return {
				...base,
				message: "Pluggy returned no transactions for this card.",
			};
		}
		const today = new Date().toISOString().slice(0, 10);
		const dataThrough =
			rows
				.filter((row) => row.localDate <= today)
				.map((row) => row.localDate)
				.toSorted()
				.at(-1) ?? null;
		if (dataThrough === null) {
			return {
				...base,
				message: "No Pluggy transaction date is available through today.",
			};
		}
		const bills = await client.bills(account);
		const [latestBill] = bills;
		const dueDate = account.credit?.balanceDueDate?.slice(0, 10) ?? latestBill?.dueDate ?? null;
		const openCycle = dueDate?.slice(0, 7) ?? today.slice(0, 7);
		const closingDate =
			account.credit?.balanceCloseDate?.slice(0, 10) ?? latestBill?.closingDate ?? null;
		const cycleRows = rows.filter(
			(row) => row.billForecastDate === openCycle || row.billId === latestBill?.id,
		);
		const posted = cycleRows
			.filter((row) => row.amountCents < 0 && !isTransfer(row))
			.reduce((sum, row) => sum - row.amountCents, 0);
		const future = rows
			.filter((row) => row.localDate > today && row.amountCents < 0)
			.reduce((sum, row) => sum + Math.abs(row.amountCents), 0);
		const committed = account.amountCents - future;
		return {
			...base,
			cycle: {
				openCycle,
				closingDate,
				dueDate,
				closingDateSource: account.credit?.balanceCloseDate ? "account" : "open-bill",
			},
			posted: toDecimal(posted),
			committed: toDecimal(committed),
			futureInstalments: toDecimal(future),
			gap: toDecimal(Math.abs(committed - posted)),
			committedIsNegative: committed < 0,
			postedExceedsCommitted: posted > committed,
			topTransactions: cycleRows
				.filter((row) => row.amountCents < 0 && !isTransfer(row))
				.toSorted((left, right) => left.amountCents - right.amountCents)
				.slice(0, 5)
				.map((row) => ({
					id: row.id,
					date: row.localDate,
					description: row.description,
					amount: toDecimal(-row.amountCents),
					category: row.category,
				})),
			dataThrough,
			staleDays: Math.max(
				0,
				Math.floor(
					(Date.now() - new Date(`${dataThrough}T00:00:00Z`).getTime()) / 86_400_000,
				),
			),
		};
	}

	async listInstalmentPlans(
		userId: string,
		input: { accountId?: string; connectionId?: string; includeSettled: boolean },
	) {
		const loaded = await this.loadFinanceData(userId);
		const { accounts } = loaded;
		if (input.accountId) {
			const selectedAccount = accounts.find((account) => account.id === input.accountId);
			if (!selectedAccount) throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
			if (selectedAccount.type !== "CREDIT") throw new Error("FINANCE_ACCOUNT_TYPE_INVALID");
		}
		let rows = loaded.transactions;
		if (input.accountId) rows = rows.filter((row) => row.accountId === input.accountId);
		if (input.connectionId) {
			this.assertInScope(input.connectionId);
			await this.requiredConnection(input.connectionId, userId);
			rows = rows.filter((row) => row.connectionId === input.connectionId);
		}
		const grouped = new Map<string, FinanceTransaction[]>();
		for (const row of rows.filter((row) => row.instalmentTotal && row.instalmentNumber)) {
			const key = `${row.accountId}|${row.purchaseDate ?? row.descriptionNorm}`;
			grouped.set(key, [...(grouped.get(key) ?? []), row]);
		}
		const plans = [...grouped.values()]
			.map((group) => {
				const latest = group.toSorted(
					(a, b) => (b.instalmentNumber ?? 0) - (a.instalmentNumber ?? 0),
				)[0]!;
				const total = latest.instalmentTotal ?? 1;
				const paid = Math.min(total, latest.instalmentNumber ?? 0);
				const amount = Math.abs(latest.amountCents);
				const account = accounts.find((candidate) => candidate.id === latest.accountId);
				if (!account) throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
				const remaining = total - paid;
				return {
					card: account.name,
					accountId: latest.accountId,
					institution: account.institution,
					currency: account.currency,
					utilization: toDecimal(account.amountCents),
					creditLimit:
						account.credit?.limitCents === null ||
						account.credit?.limitCents === undefined
							? null
							: toDecimal(account.credit.limitCents),
					availableLimit:
						account.credit?.availableLimitCents === null ||
						account.credit?.availableLimitCents === undefined
							? null
							: toDecimal(account.credit.availableLimitCents),
					merchant: latest.descriptionNorm,
					purchaseDate: latest.purchaseDate,
					purchaseTotal: toDecimal(amount * total),
					purchaseTotalSource: "estimated" as const,
					instalmentAmount: toDecimal(amount),
					instalmentsPaid: paid,
					instalmentsTotal: total,
					instalmentsRemaining: remaining,
					remainingTotal: toDecimal(amount * remaining),
					remainingTotalSource: "estimated" as const,
					finalCycle: latest.billForecastDate,
					finalCycleSource: "reported" as const,
					status: remaining > 0 ? ("open" as const) : ("settled" as const),
					renewal: false,
				};
			})
			.filter((plan) => input.includeSettled || plan.status === "open");
		const openPlans = plans.filter((plan) => plan.status === "open");
		return {
			plans,
			totals: {
				planCount: openPlans.length,
				remaining: toDecimal(
					[...grouped.values()].reduce(
						(total, group) => total + remainingCentsOf(group),
						0,
					),
				),
			},
			notes: [],
			dataThrough: dataThrough(accounts, loaded.transactions),
			unavailable: loaded.unavailable,
		};
	}

	async getInvestments(userId: string, input: InvestmentsInput) {
		if (input.connectionId) this.assertInScope(input.connectionId);
		const selected = input.connectionId
			? [await this.requiredConnection(input.connectionId, userId)]
			: await this.repository.listScopedConnections(userId);
		const positions: ProviderInvestment[] = [];
		const unavailable: { connectionId: string; kind: string; message: string }[] = [];
		for (const connection of selected) {
			const { client } = await this.client(connection, userId);
			for (const itemId of connection.itemIds) {
				try {
					// oxlint-disable-next-line no-await-in-loop -- failures are reported per provider connection.
					positions.push(...(await client.investments(itemId, connection.id)));
				} catch (error) {
					unavailable.push({
						connectionId: connection.id,
						kind: failureKind(error),
						message: safeMessage(error),
					});
				}
			}
		}
		const sortedPositions = positions.toSorted(
			(a, b) =>
				a.currency.localeCompare(b.currency) ||
				b.balanceCents - a.balanceCents ||
				a.institution.localeCompare(b.institution) ||
				a.name.localeCompare(b.name) ||
				a.id.localeCompare(b.id),
		);
		const filter = {
			connectionId: input.connectionId ?? this.repository.connectionScope ?? null,
		};
		let available = sortedPositions;
		if (input.cursor) {
			const after = decodeCursor<{ id: string }>(input.cursor, filter);
			const index = sortedPositions.findIndex((row) => row.id === after.id);
			if (index === -1) throw new Error("FINANCE_INVALID_CURSOR");
			available = sortedPositions.slice(index + 1);
		}
		const page = available.slice(0, input.limit);
		const totals = new Map<string, number>();
		for (const row of sortedPositions) {
			totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.balanceCents);
		}
		return {
			positions: page.map(({ balanceCents, ...position }) => ({
				...position,
				balance: toDecimal(balanceCents),
			})),
			totals: [...totals].map(([currency, balance]) => ({
				currency,
				balance: toDecimal(balance),
			})),
			totalPositions: sortedPositions.length,
			hasMore: available.length > input.limit,
			nextCursor:
				available.length > input.limit && page.at(-1)
					? encodeCursor(filter, { id: page.at(-1)!.id })
					: null,
			unavailable,
		};
	}

	async listSources(userId: string) {
		const sources = [];
		for (const connection of await this.repository.listScopedConnections(userId)) {
			try {
				const { client } = await this.client(connection, userId);
				// oxlint-disable-next-line no-await-in-loop -- source diagnosis preserves stable ordering.
				const item = await client.connection(connection.itemIds[0]!);
				// oxlint-disable-next-line no-await-in-loop -- source diagnosis preserves stable ordering.
				const consent = await client.consent(connection.itemIds[0]!);
				const now = new Date();
				const state: "active" | "revoked" | "expired" | "unknown" = consent?.revokedAt
					? "revoked"
					: consent?.expiresAt && consent.expiresAt < now
						? "expired"
						: consent
							? "active"
							: "unknown";
				sources.push({
					id: connection.id,
					institution: item.institution,
					status: item.status,
					executionStatus: item.executionStatus,
					lastUpdatedAt: item.lastUpdatedAt?.toISOString() ?? null,
					warnings: item.warnings,
					parameter: item.parameter,
					failedLogins: item.failedLogins,
					failure: null,
					consent: {
						state,
						expiresAt: consent?.expiresAt?.toISOString() ?? null,
						revokedAt: consent?.revokedAt?.toISOString() ?? null,
						products: consent?.products ?? null,
					},
				});
			} catch (error) {
				sources.push({
					id: connection.id,
					failure: { kind: failureKind(error), message: safeMessage(error) },
					consent: {
						state: "unknown" as const,
						expiresAt: null,
						revokedAt: null,
						products: null,
					},
				});
			}
		}
		return { sources };
	}

	private async filteredTransactions(
		userId: string,
		input: TransactionFilters & { search?: string },
	) {
		const loaded = await this.loadFinanceData(userId, input.accountIds);
		this.assertAvailable(loaded.unavailable);
		const { accounts, transactions: allTransactions } = loaded;
		const search = input.search ? normalizeTransactionSearch(input.search) : null;
		const rows = allTransactions.filter(
			(row) =>
				row.localDate >= input.startDate &&
				row.localDate <= input.endDate &&
				(!input.categories ||
					input.categories.includes((row.category ?? "none") as never)) &&
				(input.minAmountCents === undefined || row.amountCents >= input.minAmountCents) &&
				(input.maxAmountCents === undefined || row.amountCents <= input.maxAmountCents) &&
				(input.accountType === undefined || row.accountType === input.accountType) &&
				(input.accountSubtype === undefined ||
					row.accountSubtype === input.accountSubtype) &&
				(search === null ||
					normalizeTransactionSearch(
						[
							row.description,
							row.descriptionNorm,
							row.counterpartyName,
							row.document,
							row.category,
							row.paymentMethod,
						]
							.filter(Boolean)
							.join(" "),
					).includes(search)),
		);
		return { ...loaded, accounts, allTransactions, rows };
	}

	private async loadAccounts(userId: string) {
		const accounts: FinanceAccount[] = [];
		const unavailable: { connectionId: string; kind: string; message: string }[] = [];
		const clients = new Map<string, PluggyClient>();
		for (const connection of await this.repository.listScopedConnections(userId)) {
			try {
				// oxlint-disable-next-line no-await-in-loop -- each connection owns separate credentials.
				const { client } = await this.client(connection, userId);
				clients.set(connection.id, client);
				// oxlint-disable-next-line no-await-in-loop -- provider reads preserve connection isolation.
				accounts.push(...(await client.accounts(connection.itemIds, connection.id)));
			} catch (error) {
				addUnavailable(unavailable, connection.id, error);
			}
		}
		return { accounts, clients, unavailable };
	}

	private async loadFinanceData(userId: string, accountIds?: readonly string[]) {
		const loaded = await this.loadAccounts(userId);
		const selectedAccountIds = accountIds ? new Set(accountIds) : null;
		const accounts = selectedAccountIds
			? loaded.accounts.filter((account) => selectedAccountIds.has(account.id))
			: loaded.accounts;
		const transactions: FinanceTransaction[] = [];
		for (const account of accounts) {
			try {
				let client = loaded.clients.get(account.connectionId);
				if (!client) {
					// oxlint-disable-next-line no-await-in-loop -- Each connection is resolved once per request.
					const { client: resolvedClient } = await this.client(
						await this.requiredConnection(account.connectionId, userId),
						userId,
					);
					client = resolvedClient;
					loaded.clients.set(account.connectionId, client);
				}
				// oxlint-disable-next-line no-await-in-loop -- A complete provider page walk precedes composition.
				transactions.push(...(await client.transactions(account)));
			} catch (error) {
				if (error instanceof Error && error.message === "FINANCE_CONNECTION_NOT_FOUND") {
					throw error;
				}
				addUnavailable(loaded.unavailable, account.connectionId, error);
			}
		}
		return {
			accounts,
			transactions: transactions.toSorted(
				(left, right) =>
					right.localDate.localeCompare(left.localDate) ||
					right.id.localeCompare(left.id),
			),
			unavailable: loaded.unavailable,
		};
	}

	private assertAvailable(
		unavailable: readonly { connectionId: string; kind: string; message: string }[],
	) {
		if (unavailable.length > 0) throw new Error("PLUGGY_UNAVAILABLE");
	}

	private async assertOwnedAccount(
		userId: string,
		accountId: string,
		requiredType?: FinanceAccount["type"],
	) {
		const loaded = await this.loadAccounts(userId);
		const account = loaded.accounts.find((row) => row.id === accountId);
		if (!account) {
			this.assertAvailable(loaded.unavailable);
			throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
		}
		if (requiredType && account.type !== requiredType) {
			throw new Error("FINANCE_ACCOUNT_TYPE_INVALID");
		}
		return account;
	}

	private async client(connection: Connection, userId: string) {
		const clientSecret = await unseal(connection.sealedClientSecret, this.encryptionKey);
		return {
			client: this.pluggy(
				{ clientId: connection.clientId, clientSecret },
				{ userId, connectionId: connection.id },
			),
		};
	}

	/**
	 * Applied where an explicit `connectionId` selects *data*. Naming a connection
	 * to manage is a different resource entirely — `features/connections` is
	 * unscoped, so a bad selection can always be edited away. Answers not-found
	 * rather than forbidden, matching how a connection belonging to another user
	 * already behaves.
	 */
	private assertInScope(connectionId: string) {
		if (!this.repository.allowsConnection(connectionId)) {
			throw new Error("FINANCE_CONNECTION_NOT_FOUND");
		}
	}

	private async requiredConnection(connectionId: string, userId: string) {
		const row = await this.repository.getConnection(connectionId, userId);
		if (!row) throw new Error("FINANCE_CONNECTION_NOT_FOUND");
		return row;
	}
}

const failureKind = (error: unknown) =>
	error instanceof Error
		? error.message
				.toLowerCase()
				.replace(/^pluggy_/u, "")
				.replaceAll("_", "-")
		: "unavailable";
const safeMessage = (error: unknown) =>
	error instanceof Error && error.message.startsWith("PLUGGY_")
		? error.message
		: "Provider request failed";
const addUnavailable = (
	rows: { connectionId: string; kind: string; message: string }[],
	connectionId: string,
	error: unknown,
) => {
	if (rows.some((row) => row.connectionId === connectionId)) return;
	rows.push({ connectionId, kind: failureKind(error), message: safeMessage(error) });
};
const dataThrough = (
	accounts: readonly FinanceAccount[],
	transactions: readonly FinanceTransaction[],
) => {
	const today = new Date().toISOString().slice(0, 10);
	const dates = new Map(accounts.map((account) => [account.connectionId, null as string | null]));
	for (const row of transactions) {
		if (row.localDate > today) continue;
		const current = dates.get(row.connectionId);
		if (current === undefined || current === null || row.localDate > current) {
			dates.set(row.connectionId, row.localDate);
		}
	}
	return [...dates].map(([connectionId, through]) => ({ connectionId, through }));
};

const isTransfer = (row: FinanceTransaction) =>
	row.category === "04000000" || row.category === "05000000";

const remainingCentsOf = (group: readonly FinanceTransaction[]) => {
	const [latest] = group.toSorted(
		(left, right) => (right.instalmentNumber ?? 0) - (left.instalmentNumber ?? 0),
	);
	if (!latest) return 0;
	const total = latest.instalmentTotal ?? 1;
	const paid = Math.min(total, latest.instalmentNumber ?? 0);
	return Math.abs(latest.amountCents) * (total - paid);
};
