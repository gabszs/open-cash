import type { ListTransactionsInput, TransactionFilters } from "../schemas";

export type AccountType = "BANK" | "CREDIT" | "INVESTMENT" | "LOAN";

export interface CreditDetails {
	limitCents: number | null;
	availableLimitCents: number | null;
	balanceCloseDate: string | null;
	balanceDueDate: string | null;
	brand: string | null;
}

export interface FinanceAccount {
	id: string;
	connectionId: string;
	providerConnectionId: string;
	institution: string;
	name: string;
	type: AccountType;
	subtype: string | null;
	amountCents: number;
	currency: string;
	lastUpdatedAt: Date | null;
	credit: CreditDetails | null;
}

export interface FinanceTransaction {
	id: string;
	connectionId: string;
	accountId: string;
	accountType: AccountType;
	accountSubtype: string | null;
	occurredAt: string;
	localDate: string;
	amountCents: number;
	currency: string;
	originalAmountCents: number | null;
	originalCurrency: string | null;
	description: string;
	descriptionNorm: string;
	categoryId: string | null;
	document: string | null;
	counterpartyName: string | null;
	paymentMethod: string | null;
	mcc: string | null;
	billId: string | null;
	billForecastDate: string | null;
	instalmentNumber: number | null;
	instalmentTotal: number | null;
	purchaseDate: string | null;
	category: string | null;
	categorySrc: "pluggy" | "none";
}

export interface ProviderConnection {
	id: string;
	institution: string;
	status: string;
	executionStatus: string | null;
	lastUpdatedAt: Date | null;
	parameter: string | null;
	warnings: string[];
	failedLogins: number | null;
}

export interface ProviderConsent {
	expiresAt: Date | null;
	revokedAt: Date | null;
	products: string[];
}

export interface ProviderBill {
	id: string;
	closingDate: string | null;
	dueDate: string;
	totalCents: number;
	currency: string;
	minimumPaymentCents: number | null;
	financeChargesCents: number;
	paymentsCents: number;
	paymentCount: number;
}

export interface ProviderInvestment {
	id: string;
	connectionId: string;
	institution: string;
	name: string;
	type: string;
	subtype: string | null;
	balanceCents: number;
	currency: string;
	quantity: string | null;
}

export const toCents = (value: number) => {
	const cents = Math.round(value * 100);
	if (!Number.isSafeInteger(cents)) throw new Error("PLUGGY_BAD_RESPONSE");
	return cents;
};

export const toDecimal = (cents: number) => {
	const sign = cents < 0 ? "-" : "";
	const absolute = Math.abs(cents);
	return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
};

export const normalizeDescription = (value: string) =>
	value
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036F]/gu, "")
		.replaceAll(/\s+/gu, " ")
		.trim()
		.toUpperCase();

interface CursorEnvelope<T> {
	version: 1;
	filter: string;
	position: T;
}

const canonical = (value: object) =>
	JSON.stringify(
		Object.fromEntries(
			Object.entries(value)
				.filter(([, entry]) => entry !== undefined)
				.toSorted(([left], [right]) => left.localeCompare(right)),
		),
	);

export const encodeCursor = <T>(filter: object, position: T) =>
	Buffer.from(
		JSON.stringify({
			version: 1,
			filter: canonical(filter),
			position,
		} satisfies CursorEnvelope<T>),
	).toString("base64url");

export const decodeCursor = <T>(cursor: string, filter: object): T => {
	try {
		const decoded = JSON.parse(
			Buffer.from(cursor, "base64url").toString("utf-8"),
		) as CursorEnvelope<T>;
		if (
			decoded.version !== 1 ||
			decoded.filter !== canonical(filter) ||
			decoded.position === undefined
		) {
			throw new Error("Cursor does not match its filter");
		}
		return decoded.position;
	} catch {
		throw new Error("FINANCE_INVALID_CURSOR");
	}
};

/**
 * `connectionId` is part of the filter so a cursor minted under one connection
 * scope is rejected under another instead of staying structurally valid and
 * paginating into a different data set.
 */
export const transactionCursorFilter = (
	input: ListTransactionsInput | TransactionFilters,
	connectionId: string | null = null,
) => ({
	connectionId,
	startDate: input.startDate,
	endDate: input.endDate,
	accountIds: input.accountIds?.toSorted(),
	categories: input.categories,
	minAmountCents: input.minAmountCents,
	maxAmountCents: input.maxAmountCents,
	accountType: input.accountType,
	accountSubtype: input.accountSubtype,
	search: "search" in input ? input.search : undefined,
});
