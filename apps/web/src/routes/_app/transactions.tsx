import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import { useConnection } from "@/components/connectionProvider";
import { ConnectionRequired, FinancePage, QueryState } from "@/components/financePage";
import { RouteError } from "@/components/routeError";
import { RoutePending } from "@/components/routePending";
import { financeAccountsQueryOptions, useFinanceAccounts } from "@/hooks/useFinance";
import {
	financeTransactionSummaryQueryOptions,
	financeTransactionsInfiniteQueryOptions,
	useFinanceTransactions,
	useFinanceTransactionSummary,
} from "@/hooks/useFinanceTransactions";
import {
	filterTransactionsByDirection,
	groupTransactionsByDate,
	listFiltersFromSearch,
	rangeFiltersFromSearch,
	validateTransactionSearch,
} from "@/lib/transactionFilters";
import {
	TransactionFilterBar,
	TransactionLedger,
	TransactionMetrics,
} from "@/routes/_app/-components/transactionsView";

export const Route = createFileRoute("/_app/transactions")({
	validateSearch: validateTransactionSearch,
	loaderDeps: ({ search }) => ({
		listFilters: listFiltersFromSearch(search),
		rangeFilters: rangeFiltersFromSearch(search),
	}),
	loader: ({ context, deps }) => {
		const { connectionId, isLoading } = context.connection;
		if (isLoading || connectionId === null) return null;
		return Promise.all([
			context.queryClient.ensureQueryData(financeAccountsQueryOptions(connectionId)),
			context.queryClient.ensureQueryData(
				financeTransactionSummaryQueryOptions(connectionId, deps.rangeFilters),
			),
			context.queryClient.ensureInfiniteQueryData(
				financeTransactionsInfiniteQueryOptions(connectionId, deps.listFilters),
			),
		]);
	},
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: TransactionsPage,
	pendingComponent: RoutePending,
	errorComponent: RouteError,
});

function TransactionsPage() {
	const { connectionId } = useConnection();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const rangeFilters = rangeFiltersFromSearch(search);
	const listFilters = listFiltersFromSearch(search);
	const accounts = useFinanceAccounts(connectionId);
	const summary = useFinanceTransactionSummary(connectionId, rangeFilters);
	const transactions = useFinanceTransactions(connectionId, listFilters);
	const rows = useMemo(
		() => transactions.data?.pages.flatMap((page) => page.transactions) ?? [],
		[transactions.data],
	);
	const visibleRows = useMemo(
		() => filterTransactionsByDirection(rows, search.direction),
		[rows, search.direction],
	);
	const groups = useMemo(() => groupTransactionsByDate(visibleRows), [visibleRows]);
	const error = (accounts.error ?? summary.error ?? transactions.error) as Error | null;
	const initialLoading =
		accounts.isLoading || summary.isLoading || (transactions.isLoading && rows.length === 0);

	const updateSearch = useCallback(
		(next: Partial<typeof search>) =>
			void navigate({
				replace: true,
				search: (previous) => ({ ...previous, ...next }),
			}),
		[navigate],
	);

	return (
		<FinancePage
			title="Transações"
			description="Acompanhe entradas e saídas por período, conta e cartão."
		>
			<ConnectionRequired />
			<QueryState loading={initialLoading} error={error} />
			<TransactionFilterBar
				accounts={accounts.data?.accounts ?? []}
				search={search}
				onChange={updateSearch}
			/>
			<TransactionMetrics loading={summary.isLoading} summary={summary.data} />
			<TransactionLedger
				accounts={accounts.data?.accounts ?? []}
				canLoadMore={transactions.hasNextPage}
				groups={groups}
				loading={initialLoading}
				loadingMore={transactions.isFetchingNextPage}
				onLoadMore={() => void transactions.fetchNextPage()}
				summary={summary.data}
			/>
		</FinancePage>
	);
}
