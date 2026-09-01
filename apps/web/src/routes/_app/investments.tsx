import { createFileRoute } from "@tanstack/react-router";

import { useConnection } from "@/components/connectionProvider";
import { ConnectionRequired, EmptyPanel, FinancePage, QueryState } from "@/components/financePage";
import { RouteError } from "@/components/routeError";
import { RoutePending } from "@/components/routePending";
import { financeInvestmentsQueryOptions, useFinanceInvestments } from "@/hooks/useFinance";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/investments")({
	loader: ({ context }) => {
		const { connectionId, isLoading } = context.connection;
		if (isLoading || connectionId === null) return null;
		return context.queryClient.ensureQueryData(financeInvestmentsQueryOptions(connectionId));
	},
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: InvestmentsPage,
	pendingComponent: RoutePending,
	errorComponent: RouteError,
});

function InvestmentsPage() {
	const { connectionId } = useConnection();
	const investments = useFinanceInvestments(connectionId);
	const positions = investments.data?.positions ?? [];

	return (
		<FinancePage
			title="Investimentos"
			description="Posições da conexão selecionada, consultadas diretamente no Pluggy."
		>
			<ConnectionRequired />
			<QueryState loading={investments.isLoading} error={investments.error as Error | null} />
			{positions.length === 0 && !investments.isLoading ? (
				<EmptyPanel>Nenhuma posição encontrada.</EmptyPanel>
			) : (
				<section className="overflow-hidden rounded-lg border border-border bg-card max-shell:overflow-x-auto">
					<div className="grid grid-cols-[minmax(220px,1.5fr)_1fr_0.7fr_0.7fr] items-center gap-4 border-b border-border bg-secondary px-4 py-3 text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase max-shell:min-w-170">
						<span>Posição</span>
						<span>Tipo</span>
						<span>Quantidade</span>
						<span>Saldo</span>
					</div>
					{positions.map((position) => (
						<div
							className="grid min-h-14.5 grid-cols-[minmax(220px,1.5fr)_1fr_0.7fr_0.7fr] items-center gap-4 px-4 py-3 text-[13px] [&+&]:border-t [&+&]:border-border max-shell:min-w-170"
							key={position.id}
						>
							<div className="grid min-w-0 gap-0.5">
								<strong className="truncate font-medium">{position.name}</strong>
								<small className="text-xs text-muted-foreground">
									{position.institution}
								</small>
							</div>
							<span className="text-xs text-muted-foreground">{position.type}</span>
							<span className="text-xs text-muted-foreground">
								{position.quantity ?? "—"}
							</span>
							<b className="text-right font-medium">
								{formatMoney(position.balance, position.currency)}
							</b>
						</div>
					))}
				</section>
			)}
		</FinancePage>
	);
}
