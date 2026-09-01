import type {
	FinanceTransaction,
	FinanceTransactionListQuery,
	FinanceTransactionRangeFilters,
} from "@server/features/finance/schemas";

export type TransactionPeriod = "month" | "custom";
export type TransactionDirection = "all" | "income" | "expense";

export interface TransactionSearch {
	period: TransactionPeriod;
	month: string;
	from: string;
	to: string;
	accounts: string[];
	direction: TransactionDirection;
	query: string;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const monthPattern = /^\d{4}-\d{2}$/u;

export const localDateValue = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const localMonthValue = (date: Date) => localDateValue(date).slice(0, 7);

const validDate = (value: unknown): value is string => {
	if (typeof value !== "string" || !datePattern.test(value)) return false;
	const parsed = new Date(`${value}T12:00:00`);
	return !Number.isNaN(parsed.valueOf()) && localDateValue(parsed) === value;
};

const validMonth = (value: unknown): value is string => {
	if (typeof value !== "string" || !monthPattern.test(value)) return false;
	const [year, month] = value.split("-").map(Number);
	return year >= 1000 && month >= 1 && month <= 12;
};

const localDate = (value: string) => new Date(`${value}T12:00:00`);

const addLocalDays = (value: string, days: number) => {
	const date = localDate(value);
	date.setDate(date.getDate() + days);
	return localDateValue(date);
};

export const monthRange = (month: string, now = new Date()): FinanceTransactionRangeFilters => {
	const [yearValue = "0", monthValue = "0"] = month.split("-");
	const lastDay = new Date(Number(yearValue), Number(monthValue), 0).getDate();
	const startDate = `${month}-01`;
	const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
	return {
		startDate,
		endDate: month === localMonthValue(now) ? localDateValue(now) : monthEnd,
	};
};

const normalizedAccounts = (value: unknown) => {
	let values: unknown[] = [];
	if (Array.isArray(value)) values = value;
	else if (typeof value === "string") values = [value];
	return [
		...new Set(
			values.filter((item): item is string => typeof item === "string" && item.length > 0),
		),
	].toSorted();
};

export const validateTransactionSearch = (
	search: Record<string, unknown>,
	now = new Date(),
): TransactionSearch => {
	const defaultMonth = localMonthValue(now);
	const month = validMonth(search.month) ? search.month : defaultMonth;
	const fallback = monthRange(month, now);
	const customFrom = validDate(search.from) ? search.from : null;
	const customTo = validDate(search.to) ? search.to : null;
	const customRangeValid =
		search.period === "custom" &&
		customFrom !== null &&
		customTo !== null &&
		customFrom <= customTo;
	const direction =
		search.direction === "income" || search.direction === "expense" ? search.direction : "all";
	const query = typeof search.query === "string" ? search.query.trim().slice(0, 120) : "";

	return {
		period: customRangeValid ? "custom" : "month",
		month,
		from: customRangeValid ? customFrom : fallback.startDate,
		to: customRangeValid ? customTo : fallback.endDate,
		accounts: normalizedAccounts(search.accounts),
		direction,
		query,
	};
};

export const shiftTransactionPeriod = (
	search: TransactionSearch,
	direction: -1 | 1,
	now = new Date(),
): TransactionSearch => {
	if (search.period === "month") {
		const [year = 0, month = 1] = search.month.split("-").map(Number);
		const shifted = new Date(year, month - 1 + direction, 1, 12);
		const nextMonth = localMonthValue(shifted);
		const range = monthRange(nextMonth, now);
		return {
			...search,
			month: nextMonth,
			from: range.startDate,
			to: range.endDate,
		};
	}

	const rangeDays =
		Math.round(
			(localDate(search.to).valueOf() - localDate(search.from).valueOf()) / 86_400_000,
		) + 1;
	return {
		...search,
		from: addLocalDays(search.from, direction * rangeDays),
		to: addLocalDays(search.to, direction * rangeDays),
	};
};

export const rangeFiltersFromSearch = (
	search: TransactionSearch,
): FinanceTransactionRangeFilters => ({
	startDate: search.from,
	endDate: search.to,
	...(search.accounts.length > 0 ? { accountIds: search.accounts } : {}),
});

export const listFiltersFromSearch = (search: TransactionSearch): FinanceTransactionListQuery => ({
	...rangeFiltersFromSearch(search),
	...(search.query ? { search: search.query } : {}),
});

export const filterTransactionsByDirection = (
	transactions: readonly FinanceTransaction[],
	direction: TransactionDirection,
) => {
	if (direction === "all") return transactions;
	return transactions.filter((transaction) =>
		direction === "income" ? Number(transaction.amount) > 0 : Number(transaction.amount) < 0,
	);
};

export const groupTransactionsByDate = (transactions: readonly FinanceTransaction[]) => {
	const groups = new Map<string, FinanceTransaction[]>();
	for (const transaction of transactions) {
		groups.set(transaction.date, [...(groups.get(transaction.date) ?? []), transaction]);
	}
	return [...groups].map(([date, rows]) => ({ date, transactions: rows }));
};

export const CATEGORY_LABELS: Readonly<Record<string, string>> = {
	"01000000": "Renda",
	"02000000": "Empréstimos e financiamento",
	"03000000": "Investimentos",
	"04000000": "Transferência entre contas",
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
