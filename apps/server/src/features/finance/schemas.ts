// Reached for directly rather than through `baseSchemas`: that module loads
// `cloudflare:workers`, and this file is imported by the `bun test` unit suite.
import { uuidV7Field } from "@server/common/schemas/primitives";
import { z } from "zod";

export const CATEGORY_IDS = [
	"01000000",
	"02000000",
	"03000000",
	"04000000",
	"05000000",
	"06000000",
	"07000000",
	"08000000",
	"09000000",
	"10000000",
	"11000000",
	"12000000",
	"13000000",
	"14000000",
	"15000000",
	"16000000",
	"17000000",
	"18000000",
	"19000000",
	"20000000",
	"21000000",
	"99999999",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const categorySchema = z.enum(CATEGORY_IDS);
export const categoryFilterSchema = z.union([categorySchema, z.literal("none")]);
export const accountTypeSchema = z.enum(["BANK", "CREDIT", "INVESTMENT", "LOAN"]);
export const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/u);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
/** A Pluggy resource id: opaque to us, so only bounded, never shaped. */
export const providerIdSchema = z.string().min(1).max(200);

export const accountPathSchema = z.object({ accountId: providerIdSchema });

export const unavailableSchema = z.object({
	connectionId: uuidV7Field,
	kind: z.string(),
	message: z.string(),
});

export const creditDetailsSchema = z.object({
	limit: moneySchema.nullable(),
	availableLimit: moneySchema.nullable(),
	balanceCloseDate: z.string().datetime().nullable(),
	balanceDueDate: z.string().datetime().nullable(),
	brand: z.string().nullable(),
});

export const financeAccountSchema = z.object({
	id: providerIdSchema,
	connectionId: uuidV7Field,
	institution: z.string(),
	name: z.string(),
	type: accountTypeSchema,
	subtype: z.string().nullable(),
	balance: moneySchema.optional(),
	usedCredit: moneySchema.optional(),
	currency: z.string(),
	lastUpdatedAt: z.string().datetime().nullable(),
	credit: creditDetailsSchema.nullable(),
});

export const accountsResponseSchema = z.object({
	accounts: z.array(financeAccountSchema),
	unavailable: z.array(unavailableSchema),
});

export const balanceResponseSchema = z.object({
	cash: moneySchema,
	creditUsed: moneySchema,
	invested: moneySchema.optional(),
	loans: moneySchema.optional(),
	currency: z.string(),
	accountsCounted: z.number().int().nonnegative(),
	asOf: z.array(
		z.object({
			connectionId: uuidV7Field,
			lastUpdatedAt: z.string().datetime().nullable(),
		}),
	),
});

export const transactionFiltersSchema = z
	.object({
		startDate: dateSchema,
		endDate: dateSchema,
		categories: z.array(categoryFilterSchema).optional(),
		accountIds: z
			.preprocess(
				(value) => (typeof value === "string" ? [value] : value),
				z.array(providerIdSchema).min(1).max(100),
			)
			.refine((value) => new Set(value).size === value.length, {
				message: "accountIds must not contain duplicates",
			})
			.optional(),
		minAmountCents: z.coerce.number().int().optional(),
		maxAmountCents: z.coerce.number().int().optional(),
		accountType: accountTypeSchema.optional(),
		accountSubtype: z.string().min(1).optional(),
	})
	.refine((value) => value.startDate <= value.endDate, {
		message: "endDate must not be before startDate",
		path: ["endDate"],
	});

export const listTransactionsSchema = transactionFiltersSchema.extend({
	limit: z.coerce.number().int().min(1).max(100).default(100),
	cursor: z.string().min(1).optional(),
	search: z.string().trim().min(1).max(120).optional(),
});

export const transactionSchema = z.object({
	id: providerIdSchema,
	accountId: providerIdSchema.optional(),
	accountType: accountTypeSchema.optional(),
	accountSubtype: z.string().nullable().optional(),
	date: dateSchema,
	occurredAt: z.string().optional(),
	description: z.string().optional(),
	descriptionNorm: z.string(),
	amount: moneySchema,
	currency: z.string().optional(),
	original: z.object({ amount: moneySchema, currency: z.string() }).optional(),
	category: z.string().nullable(),
	categorySrc: z.enum(["pluggy", "none"]),
	categoryId: z.string().nullable().optional(),
	counterparty: z
		.object({ document: z.string().optional(), name: z.string().optional() })
		.optional(),
	paymentMethod: z.string().nullable().optional(),
	instalment: z
		.object({ number: z.number().int().optional(), total: z.number().int().optional() })
		.optional(),
	purchaseDate: z.string().nullable().optional(),
	mcc: z.string().nullable().optional(),
	billId: z.string().nullable().optional(),
});

export const listTransactionsResponseSchema = z.object({
	transactions: z.array(transactionSchema),
	cursor: z.string().optional(),
	notice: z.string().optional(),
});

export const transactionDetailsInputSchema = z
	.object({ ids: z.array(providerIdSchema).min(1).max(20) })
	.refine((value) => new Set(value.ids).size === value.ids.length, {
		message: "ids must not contain duplicates",
		path: ["ids"],
	});

export const transactionDetailsResponseSchema = z.object({
	transactions: z.array(transactionSchema),
});

export const transactionGroupSchema = z.object({
	category: z.string().nullable(),
	label: z.string(),
	total: moneySchema,
	count: z.number().int().nonnegative(),
	sampleIds: z.array(providerIdSchema).max(10),
});

export const transactionsSummaryResponseSchema = z.object({
	from: dateSchema,
	to: dateSchema,
	spent: moneySchema,
	received: moneySchema,
	upcoming: z.object({ total: moneySchema, count: z.number().int().positive() }).optional(),
	currency: z.string(),
	days: z.array(
		z.object({
			date: dateSchema,
			received: moneySchema,
			spent: moneySchema,
			count: z.number().int().positive(),
		}),
	),
	groups: z.array(transactionGroupSchema),
	accountsCovered: z.number().int().nonnegative(),
	dataThrough: z.array(z.object({ connectionId: uuidV7Field, through: dateSchema.nullable() })),
});

export const billsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(12),
});
export const billSchema = z.object({
	id: providerIdSchema,
	closingDate: dateSchema.nullable(),
	dueDate: dateSchema,
	total: moneySchema,
	currency: z.string(),
	minimumPayment: moneySchema.nullable(),
	financeCharges: moneySchema,
	payments: moneySchema,
	paymentCount: z.number().int().nonnegative(),
});
export const billsResponseSchema = z.object({ bills: z.array(billSchema) });

export const billSummaryResponseSchema = z.object({
	accountId: providerIdSchema,
	institution: z.string(),
	currency: z.string(),
	utilization: moneySchema,
	creditLimit: moneySchema.nullable(),
	availableLimit: moneySchema.nullable(),
	cycle: z
		.object({
			openCycle: z.string(),
			closingDate: dateSchema.nullable(),
			dueDate: dateSchema.nullable(),
			closingDateSource: z.string(),
		})
		.optional(),
	posted: moneySchema.optional(),
	committed: moneySchema.optional(),
	futureInstalments: moneySchema.optional(),
	gap: moneySchema.optional(),
	committedIsNegative: z.boolean().optional(),
	postedExceedsCommitted: z.boolean().optional(),
	topTransactions: z
		.array(
			z.object({
				id: providerIdSchema,
				date: dateSchema,
				description: z.string(),
				amount: moneySchema,
				category: z.string().nullable(),
			}),
		)
		.optional(),
	dataThrough: dateSchema.optional(),
	staleDays: z.number().int().nonnegative().optional(),
	message: z.string().optional(),
});

export const instalmentPlansQuerySchema = z.object({
	accountId: providerIdSchema.optional(),
	connectionId: uuidV7Field.optional(),
	includeSettled: z.coerce.boolean().default(false),
});
export const instalmentPlanSchema = z.object({
	card: z.string(),
	accountId: providerIdSchema,
	institution: z.string(),
	currency: z.string(),
	utilization: moneySchema,
	creditLimit: moneySchema.nullable(),
	availableLimit: moneySchema.nullable(),
	merchant: z.string(),
	purchaseDate: z.string().nullable(),
	purchaseTotal: moneySchema.nullable(),
	purchaseTotalSource: z.enum(["reported", "estimated", "derived"]),
	instalmentAmount: moneySchema,
	instalmentsPaid: z.number().int().nonnegative(),
	instalmentsTotal: z.number().int().positive(),
	instalmentsRemaining: z.number().int().nonnegative(),
	remainingTotal: moneySchema,
	remainingTotalSource: z.enum(["reported", "estimated", "derived"]),
	finalCycle: z.string().nullable(),
	finalCycleSource: z.enum(["reported", "estimated", "derived"]),
	status: z.enum(["open", "settled"]),
	renewal: z.boolean(),
});
export const instalmentPlansResponseSchema = z.object({
	plans: z.array(instalmentPlanSchema),
	totals: z.object({ planCount: z.number().int().nonnegative(), remaining: moneySchema }),
	notes: z.array(z.string()),
	dataThrough: z.array(z.object({ connectionId: uuidV7Field, through: dateSchema.nullable() })),
	unavailable: z.array(unavailableSchema),
	notice: z.string().optional(),
});

export const investmentsQuerySchema = z.object({
	connectionId: uuidV7Field.optional(),
	limit: z.coerce.number().int().min(1).max(100).default(100),
	cursor: z.string().min(1).optional(),
});
export const investmentSchema = z.object({
	id: providerIdSchema,
	connectionId: uuidV7Field,
	institution: z.string(),
	name: z.string(),
	type: z.string(),
	subtype: z.string().nullable(),
	balance: moneySchema,
	currency: z.string(),
	quantity: z.string().nullable(),
});
export const investmentsResponseSchema = z.object({
	positions: z.array(investmentSchema),
	totals: z.array(z.object({ currency: z.string(), balance: moneySchema })),
	totalPositions: z.number().int().nonnegative(),
	hasMore: z.boolean(),
	nextCursor: z.string().nullable(),
	unavailable: z.array(unavailableSchema),
});

export const sourceSchema = z.object({
	id: uuidV7Field,
	institution: z.string().optional(),
	status: z.string().optional(),
	executionStatus: z.string().nullable().optional(),
	lastUpdatedAt: z.string().datetime().nullable().optional(),
	warnings: z.array(z.string()).optional(),
	parameter: z.string().nullable().optional(),
	failedLogins: z.number().int().nullable().optional(),
	failure: z.object({ kind: z.string(), message: z.string() }).nullable(),
	consent: z.object({
		state: z.enum(["active", "revoked", "expired", "unknown"]),
		expiresAt: z.string().datetime().nullable(),
		revokedAt: z.string().datetime().nullable(),
		products: z.array(z.string()).nullable(),
	}),
});
export const sourcesResponseSchema = z.object({ sources: z.array(sourceSchema) });

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;
export type InvestmentsInput = z.infer<typeof investmentsQuerySchema>;

/** Public HTTP transport types. Browser code imports these instead of mirroring schemas. */
export type FinanceAccount = z.infer<typeof financeAccountSchema>;
export type FinanceTransaction = z.infer<typeof transactionSchema>;
export type FinanceInvestment = z.infer<typeof investmentSchema>;
export type FinanceSource = z.infer<typeof sourceSchema>;
export type FinanceAccountsResponse = z.infer<typeof accountsResponseSchema>;
export type FinanceBalanceResponse = z.infer<typeof balanceResponseSchema>;
export type FinanceInvestmentsResponse = z.infer<typeof investmentsResponseSchema>;
export type FinanceSourcesResponse = z.infer<typeof sourcesResponseSchema>;
export type FinanceTransactionsResponse = z.infer<typeof listTransactionsResponseSchema>;
export type FinanceTransactionsSummary = z.infer<typeof transactionsSummaryResponseSchema>;
export type FinanceTransactionDetailsResponse = z.infer<typeof transactionDetailsResponseSchema>;

/** Filter subsets used by the browser views, still owned by the server contract. */
export type FinanceTransactionRangeFilters = Pick<
	TransactionFilters,
	"accountIds" | "endDate" | "startDate"
>;
export type FinanceTransactionListFilters = FinanceTransactionRangeFilters &
	Pick<ListTransactionsInput, "cursor" | "maxAmountCents" | "minAmountCents" | "search">;
export type FinanceTransactionListQuery = Omit<FinanceTransactionListFilters, "cursor">;
