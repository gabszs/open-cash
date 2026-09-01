import { createFileRoute } from "@tanstack/react-router";

import { useConnection } from "@/components/connectionProvider";
import { ConnectionRequired, EmptyPanel, FinancePage, QueryState } from "@/components/financePage";
import { RouteError } from "@/components/routeError";
import { RoutePending } from "@/components/routePending";
import { badgeClass } from "@/components/ui/styles";
import { financeAccountsQueryOptions, useFinanceAccounts } from "@/hooks/useFinance";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/cards")({
	loader: ({ context }) => {
		const { connectionId, isLoading } = context.connection;
		if (isLoading || connectionId === null) return null;
		return context.queryClient.ensureQueryData(financeAccountsQueryOptions(connectionId));
	},
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: CardsPage,
	pendingComponent: RoutePending,
	errorComponent: RouteError,
});

function CardsPage() {
	const { connectionId } = useConnection();
	const accounts = useFinanceAccounts(connectionId);
	const cards = accounts.data?.accounts.filter((account) => account.type === "CREDIT") ?? [];

	return (
		<FinancePage
			title="Cartões de crédito"
			description="Limites e utilização informados diretamente pelo Pluggy."
		>
			<ConnectionRequired />
			<QueryState loading={accounts.isLoading} error={accounts.error as Error | null} />
			{cards.length === 0 && !accounts.isLoading ? (
				<EmptyPanel>Nenhum cartão de crédito conectado.</EmptyPanel>
			) : (
				<section className="grid grid-cols-3 gap-3 max-wide:grid-cols-2 max-mobile:grid-cols-1">
					{cards.map((account) => (
						<article
							className="flex min-h-45 flex-col rounded-xl border border-sidebar-border bg-[linear-gradient(150deg,var(--card),var(--background))] p-4.5 shadow-[var(--shadow-sm)] [&_small]:text-xs [&_small]:text-muted-foreground [&_strong]:text-sm [&_strong]:font-medium"
							key={account.id}
						>
							<div className="grid gap-1">
								<small>{account.institution}</small>
								<strong>{account.name}</strong>
							</div>
							<span className={`${badgeClass} mt-auto w-fit`}>
								{account.credit?.brand ?? "Crédito"}
							</span>
							<footer className="mt-3.5 grid grid-cols-2 gap-3 border-t border-border pt-3">
								<div className="grid gap-0.75">
									<small>Utilizado</small>
									<strong>
										{formatMoney(account.usedCredit, account.currency)}
									</strong>
								</div>
								<div className="grid gap-0.75">
									<small>Disponível</small>
									<strong>
										{formatMoney(
											account.credit?.availableLimit ?? undefined,
											account.currency,
										)}
									</strong>
								</div>
							</footer>
						</article>
					))}
				</section>
			)}
		</FinancePage>
	);
}
