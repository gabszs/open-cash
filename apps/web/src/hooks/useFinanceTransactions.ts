import type {
	FinanceTransactionListFilters,
	FinanceTransactionListQuery,
	FinanceTransactionRangeFilters,
	FinanceTransactionsResponse,
	FinanceTransactionsSummary,
} from "@server/features/finance/schemas";

import {
	infiniteQueryOptions,
	keepPreviousData,
	queryOptions,
	useInfiniteQuery,
	useQuery,
} from "@tanstack/react-query";

import { serverClient } from "@/lib/serverClient";

import {
	financeRequestOptions,
	financeResponseError,
	hasSelectedConnection,
	loadSelectedConnection,
	scopedFinanceKey,
} from "./financeShared";

const transactionQuery = (filters: FinanceTransactionListFilters) => ({
	accountIds: filters.accountIds,
	endDate: filters.endDate,
	limit: "100",
	maxAmountCents: filters.maxAmountCents?.toString(),
	minAmountCents: filters.minAmountCents?.toString(),
	search: filters.search,
	startDate: filters.startDate,
	...(filters.cursor ? { cursor: filters.cursor } : {}),
});

const summaryQuery = (filters: FinanceTransactionRangeFilters) => ({
	accountIds: filters.accountIds,
	endDate: filters.endDate,
	startDate: filters.startDate,
});

async function loadTransactions(
	connectionId: string,
	filters: FinanceTransactionListFilters,
	signal: AbortSignal,
): Promise<FinanceTransactionsResponse> {
	const response = await serverClient.v1.finance.transactions.$get(
		{ header: {}, query: transactionQuery(filters) },
		financeRequestOptions(connectionId, signal),
	);
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

async function loadTransactionSummary(
	connectionId: string,
	filters: FinanceTransactionRangeFilters,
	signal: AbortSignal,
): Promise<FinanceTransactionsSummary> {
	const response = await serverClient.v1.finance.transactions.summary.$get(
		{ header: {}, query: summaryQuery(filters) },
		financeRequestOptions(connectionId, signal),
	);
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

export const financeTransactionSummaryQueryOptions = (
	connectionId: string | null,
	filters: FinanceTransactionRangeFilters,
) =>
	queryOptions({
		queryKey: scopedFinanceKey(connectionId, "transactions", "summary", filters),
		queryFn: loadSelectedConnection(connectionId, (selected, signal) =>
			loadTransactionSummary(selected, filters, signal),
		),
		enabled: hasSelectedConnection(connectionId),
		placeholderData: keepPreviousData,
	});

export const financeTransactionsInfiniteQueryOptions = (
	connectionId: string | null,
	filters: FinanceTransactionListQuery,
) =>
	infiniteQueryOptions({
		queryKey: scopedFinanceKey(connectionId, "transactions", "list", filters),
		queryFn: ({ pageParam, signal }) => {
			if (connectionId === null) throw new Error("No finance connection selected");
			return loadTransactions(
				connectionId,
				{ ...filters, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
			);
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (page) => page.cursor,
		enabled: hasSelectedConnection(connectionId),
		placeholderData: keepPreviousData,
	});

export function useFinanceTransactionSummary(
	connectionId: string | null,
	filters: FinanceTransactionRangeFilters,
) {
	return useQuery(financeTransactionSummaryQueryOptions(connectionId, filters));
}

export function useFinanceTransactions(
	connectionId: string | null,
	filters: FinanceTransactionListQuery,
) {
	return useInfiniteQuery(financeTransactionsInfiniteQueryOptions(connectionId, filters));
}
