import type {
	FinanceAccountsResponse,
	FinanceBalanceResponse,
	FinanceInvestmentsResponse,
	FinanceTransactionsSummary,
} from "@server/features/finance/schemas";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { serverClient } from "@/lib/serverClient";

import {
	financeRequestOptions,
	financeResponseError,
	hasSelectedConnection,
	loadSelectedConnection,
	scopedFinanceKey,
} from "./financeShared";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

async function loadAccounts(
	connectionId: string,
	signal: AbortSignal,
): Promise<FinanceAccountsResponse> {
	const response = await serverClient.v1.finance.accounts.$get(
		{ header: {} },
		financeRequestOptions(connectionId, signal),
	);
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

async function loadBalance(
	connectionId: string,
	signal: AbortSignal,
): Promise<FinanceBalanceResponse> {
	const response = await serverClient.v1.finance.balance.$get(
		{ header: {} },
		financeRequestOptions(connectionId, signal),
	);
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

async function loadInvestments(
	connectionId: string,
	signal: AbortSignal,
): Promise<FinanceInvestmentsResponse> {
	const response = await serverClient.v1.finance.investments.$get(
		{ header: {}, query: { limit: "100" } },
		financeRequestOptions(connectionId, signal),
	);
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

async function loadSummary(
	connectionId: string,
	days: number,
	signal: AbortSignal,
): Promise<FinanceTransactionsSummary> {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - days);
	const response = await serverClient.v1.finance.transactions.summary.$get(
		{
			header: {},
			query: { endDate: isoDate(end), startDate: isoDate(start) },
		},
		financeRequestOptions(connectionId, signal),
	);
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

export const financeAccountsQueryOptions = (connectionId: string | null) =>
	queryOptions({
		queryKey: scopedFinanceKey(connectionId, "accounts"),
		queryFn: loadSelectedConnection(connectionId, loadAccounts),
		enabled: hasSelectedConnection(connectionId),
	});

export const financeBalanceQueryOptions = (connectionId: string | null) =>
	queryOptions({
		queryKey: scopedFinanceKey(connectionId, "balance"),
		queryFn: loadSelectedConnection(connectionId, loadBalance),
		enabled: hasSelectedConnection(connectionId),
	});

export const financeInvestmentsQueryOptions = (connectionId: string | null) =>
	queryOptions({
		queryKey: scopedFinanceKey(connectionId, "investments"),
		queryFn: loadSelectedConnection(connectionId, loadInvestments),
		enabled: hasSelectedConnection(connectionId),
	});

export const financeSummaryQueryOptions = (connectionId: string | null, days: number) =>
	queryOptions({
		queryKey: scopedFinanceKey(connectionId, "summary", days),
		queryFn: loadSelectedConnection(connectionId, (selected, signal) =>
			loadSummary(selected, days, signal),
		),
		enabled: hasSelectedConnection(connectionId),
	});

export function useFinanceAccounts(connectionId: string | null) {
	return useQuery(financeAccountsQueryOptions(connectionId));
}

export function useFinanceBalance(connectionId: string | null) {
	return useQuery(financeBalanceQueryOptions(connectionId));
}

export function useFinanceInvestments(connectionId: string | null) {
	return useQuery(financeInvestmentsQueryOptions(connectionId));
}

export function useFinanceSummary(connectionId: string | null, days: number) {
	return useQuery(financeSummaryQueryOptions(connectionId, days));
}
