import type {
	Connection,
	ConnectionCreate,
	ConnectionUpdate,
} from "@server/features/connections/schemas";
import type { FinanceSourcesResponse } from "@server/features/finance/schemas";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { serverClient } from "@/lib/serverClient";

import {
	financeKey,
	financeRequestOptions,
	financeResponseError,
	hasSelectedConnection,
	loadSelectedConnection,
	scopedFinanceKey,
} from "./financeShared";

async function loadConnections(): Promise<Connection[]> {
	// The picker shows every connection, and oldest first is the order users
	// already know — the endpoint defaults to a page of newest-first rows.
	const response = await serverClient.v1.connections.$get({
		header: {},
		query: { ordering: "created_at", page_size: "all" },
	});
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

async function loadSources(
	connectionId: string,
	signal: AbortSignal,
): Promise<FinanceSourcesResponse> {
	const response = await serverClient.v1.finance.sources.$get(
		{ header: {} },
		financeRequestOptions(connectionId, signal),
	);
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

async function createConnection(input: ConnectionCreate): Promise<Connection> {
	const response = await serverClient.v1.connections.$post({ header: {}, json: input });
	if (response.status !== 201) throw await financeResponseError(response);
	return await response.json();
}

async function updateConnection({
	connectionId,
	input,
}: {
	connectionId: string;
	input: ConnectionUpdate;
}): Promise<Connection> {
	const response = await serverClient.v1.connections[":connectionId"].$patch({
		header: {},
		json: input,
		param: { connectionId },
	});
	if (response.status !== 200) throw await financeResponseError(response);
	return await response.json();
}

async function deleteConnection(connectionId: string): Promise<void> {
	const response = await serverClient.v1.connections[":connectionId"].$delete({
		header: {},
		param: { connectionId },
	});
	if (response.status !== 204) throw await financeResponseError(response);
}

export const financeConnectionsQueryOptions = queryOptions({
	queryKey: [...financeKey, "connections"] as const,
	queryFn: loadConnections,
});

export const financeSourcesQueryOptions = (connectionId: string | null) =>
	queryOptions({
		queryKey: scopedFinanceKey(connectionId, "sources"),
		queryFn: loadSelectedConnection(connectionId, loadSources),
		enabled: hasSelectedConnection(connectionId),
	});

export function useFinanceConnections() {
	return useQuery(financeConnectionsQueryOptions);
}

export function useFinanceSources(connectionId: string | null) {
	return useQuery(financeSourcesQueryOptions(connectionId));
}

export function useCreateFinanceConnection() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createConnection,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKey }),
	});
}

export function useUpdateFinanceConnection() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: updateConnection,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKey }),
	});
}

export function useDeleteFinanceConnection() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteConnection,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKey }),
	});
}
