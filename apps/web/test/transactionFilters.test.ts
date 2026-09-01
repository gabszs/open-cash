import type { FinanceTransaction } from "@server/features/finance/schemas";

import { describe, expect, test } from "bun:test";

import {
	filterTransactionsByDirection,
	groupTransactionsByDate,
	listFiltersFromSearch,
	monthRange,
	shiftTransactionPeriod,
	validateTransactionSearch,
} from "../src/lib/transactionFilters";

const now = new Date(2026, 7, 10, 23, 30);

const transaction = (id: string, date: string): FinanceTransaction => ({
	id,
	date,
	descriptionNorm: id,
	amount: "1.00",
	category: null,
	categorySrc: "none",
});

describe("transaction filters", () => {
	test("opens the current month using local calendar dates", () => {
		expect(validateTransactionSearch({}, now)).toEqual({
			period: "month",
			month: "2026-08",
			from: "2026-08-01",
			to: "2026-08-10",
			accounts: [],
			direction: "all",
			query: "",
		});
		expect(monthRange("2026-07", now)).toEqual({
			startDate: "2026-07-01",
			endDate: "2026-07-31",
		});
	});

	test("normalizes custom dates, accounts and direction into API filters", () => {
		const search = validateTransactionSearch(
			{
				period: "custom",
				from: "2026-06-15",
				to: "2026-07-03",
				accounts: ["card-2", "account-1", "card-2"],
				direction: "expense",
				query: "  mercado central  ",
			},
			now,
		);
		expect(listFiltersFromSearch(search)).toEqual({
			startDate: "2026-06-15",
			endDate: "2026-07-03",
			accountIds: ["account-1", "card-2"],
			search: "mercado central",
		});
	});

	test("filters direction locally without changing the API filters", () => {
		const rows = [
			{ ...transaction("income", "2026-08-10"), amount: "10.00" },
			{ ...transaction("zero", "2026-08-10"), amount: "0.00" },
			{ ...transaction("expense", "2026-08-10"), amount: "-5.00" },
		];

		expect(filterTransactionsByDirection(rows, "all").map(({ id }) => id)).toEqual([
			"income",
			"zero",
			"expense",
		]);
		expect(filterTransactionsByDirection(rows, "income").map(({ id }) => id)).toEqual([
			"income",
		]);
		expect(filterTransactionsByDirection(rows, "expense").map(({ id }) => id)).toEqual([
			"expense",
		]);
	});

	test("moves month and custom ranges without converting through UTC", () => {
		expect(
			shiftTransactionPeriod(validateTransactionSearch({ month: "2026-07" }, now), -1, now),
		).toMatchObject({
			period: "month",
			month: "2026-06",
			from: "2026-06-01",
			to: "2026-06-30",
		});

		expect(
			shiftTransactionPeriod(
				validateTransactionSearch(
					{ period: "custom", from: "2026-06-15", to: "2026-07-03" },
					now,
				),
				1,
				now,
			),
		).toMatchObject({
			period: "custom",
			from: "2026-07-04",
			to: "2026-07-22",
		});
	});

	test("falls back from an invalid custom range and preserves descending groups", () => {
		expect(
			validateTransactionSearch(
				{ period: "custom", from: "2026-08-20", to: "2026-08-01" },
				now,
			).period,
		).toBe("month");
		const rows = [transaction("new", "2026-08-10"), transaction("old", "2026-08-09")];
		expect(groupTransactionsByDate(rows).map(({ date }) => date)).toEqual([
			"2026-08-10",
			"2026-08-09",
		]);
	});
});
