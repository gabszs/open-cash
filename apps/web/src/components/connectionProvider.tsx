import type { PropsWithChildren } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useMemo } from "react";

import { orpcClient } from "@/lib/orpc";

interface ConnectionContextValue {
	/** Null means nothing is selected: screens zero out and alert instead of querying. */
	connectionId: string | null;
	/**
	 * True until settings have been read once. Unlike the theme there is no safe
	 * local default to start from, so querying before this resolves would render a
	 * flash of the wrong connection's figures.
	 */
	isLoading: boolean;
	/** Set when settings could not be read at all — distinct from "none selected". */
	error: string | null;
	selectConnection: (connectionId: string | null) => Promise<void>;
	/** Re-reads settings, for when the server changed them behind our back. */
	reloadConnection: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

const settingsKey = ["settings"] as const;
const isScopedFinanceQuery = (query: { queryKey: readonly unknown[] }) =>
	query.queryKey[0] === "finance" && query.queryKey[1] !== "connections";

export function ConnectionProvider({ children }: PropsWithChildren) {
	const queryClient = useQueryClient();
	const settings = useQuery({
		queryKey: settingsKey,
		queryFn: () => orpcClient.settings.get(),
		// A missing settings row answers NOT_FOUND, which is the ordinary first-run
		// state rather than a transient failure — retrying it just delays the render.
		retry: false,
	});

	const selectConnection = useCallback(
		async (next: string | null) => {
			// Abort provider reads made for the previous selection. The Finance query
			// functions pass React Query's AbortSignal through to fetch.
			await queryClient.cancelQueries({ predicate: isScopedFinanceQuery });
			const updated = await orpcClient.settings.update({ connectionId: next });
			queryClient.setQueryData(settingsKey, updated);
			// Responses from the previous selection are disposable UI state; the next
			// screen load must read the newly selected Pluggy connection.
			queryClient.removeQueries({ predicate: isScopedFinanceQuery });
		},
		[queryClient],
	);

	const reloadConnection = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: settingsKey });
		queryClient.removeQueries({ predicate: isScopedFinanceQuery });
	}, [queryClient]);

	const value = useMemo(() => {
		// No settings row yet means "nothing selected", not a failure to report.
		const code = (settings.error as { code?: string } | null)?.code;
		return {
			connectionId: settings.data?.connectionId ?? null,
			error:
				settings.error && code !== "NOT_FOUND"
					? "Não foi possível ler a conexão ativa."
					: null,
			isLoading: settings.isLoading,
			reloadConnection,
			selectConnection,
		};
	}, [settings.data, settings.error, settings.isLoading, reloadConnection, selectConnection]);

	return <ConnectionContext value={value}>{children}</ConnectionContext>;
}

export function useConnection() {
	const context = use(ConnectionContext);
	if (!context) {
		throw new Error("useConnection must be used inside ConnectionProvider");
	}
	return context;
}
