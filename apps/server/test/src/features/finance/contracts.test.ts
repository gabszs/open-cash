import { describe, expect, test } from "bun:test";

import {
	FINANCE_CAPABILITIES,
	FINANCE_TOOL_NAMES,
} from "../../../../src/features/finance/common/contracts";
import {
	decodeCursor,
	encodeCursor,
	toDecimal,
} from "../../../../src/features/finance/common/domain";
import {
	listTransactionsSchema,
	transactionFiltersSchema,
} from "../../../../src/features/finance/schemas";

describe("finance transport contract", () => {
	test("maps exactly the eleven read-only tools to distinct HTTP capabilities", () => {
		expect(FINANCE_TOOL_NAMES).toEqual([
			"getAccounts",
			"getBalanceByAccount",
			"getBalance",
			"getTransactions",
			"listTransactions",
			"getTransactionDetails",
			"getInvestments",
			"getBills",
			"getBillSummary",
			"listInstalmentPlans",
			"listSources",
		]);
		expect(new Set(FINANCE_CAPABILITIES.map(({ service }) => service)).size).toBe(11);
		expect(FINANCE_CAPABILITIES.every(({ route }) => route.startsWith("/finance/"))).toBe(true);
	});
});

describe("finance domain boundaries", () => {
	test("formats integer cents without passing money through floating point output", () => {
		expect(toDecimal(0)).toBe("0.00");
		expect(toDecimal(-123_456)).toBe("-1234.56");
	});

	test("binds cursors to their complete filter", () => {
		const cursor = encodeCursor(
			{ startDate: "2026-01-01", endDate: "2026-01-31" },
			{ localDate: "2026-01-20", id: "tx" },
		);
		expect(
			decodeCursor<{ localDate: string; id: string }>(cursor, {
				endDate: "2026-01-31",
				startDate: "2026-01-01",
			}),
		).toEqual({
			localDate: "2026-01-20",
			id: "tx",
		});
		expect(() =>
			decodeCursor(cursor, { startDate: "2026-02-01", endDate: "2026-02-28" }),
		).toThrow("FINANCE_INVALID_CURSOR");
	});

	test("accepts one or many repeated account ids from HTTP query parameters", () => {
		expect(
			transactionFiltersSchema.parse({
				accountIds: "account-1",
				startDate: "2026-08-01",
				endDate: "2026-08-31",
			}).accountIds,
		).toEqual(["account-1"]);
		expect(() =>
			transactionFiltersSchema.parse({
				accountIds: ["account-1", "account-1"],
				startDate: "2026-08-01",
				endDate: "2026-08-31",
			}),
		).toThrow();
	});

	test("normalizes the optional full-list transaction search", () => {
		expect(
			listTransactionsSchema.parse({
				startDate: "2026-08-01",
				endDate: "2026-08-31",
				search: "  Café Central  ",
			}).search,
		).toBe("Café Central");
		expect(() =>
			listTransactionsSchema.parse({
				startDate: "2026-08-01",
				endDate: "2026-08-31",
				search: "   ",
			}),
		).toThrow();
	});
});
