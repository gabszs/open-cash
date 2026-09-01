import type { FinanceSource } from "@server/features/finance/schemas";

import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";

import { useConnection } from "@/components/connectionProvider";
import { EmptyPanel, FinancePage, QueryState } from "@/components/financePage";
import { RouteError } from "@/components/routeError";
import { RoutePending } from "@/components/routePending";
import { badgeClass } from "@/components/ui/styles";
import {
	financeConnectionsQueryOptions,
	financeSourcesQueryOptions,
	useFinanceConnections,
	useFinanceSources,
} from "@/hooks/useFinanceConnections";

export const Route = createFileRoute("/_app/open-finance")({
	loader: ({ context }) => {
		const requests: Promise<unknown>[] = [
			context.queryClient.ensureQueryData(financeConnectionsQueryOptions),
		];
		const { connectionId, isLoading } = context.connection;
		if (!isLoading && connectionId !== null) {
			requests.push(
				context.queryClient.ensureQueryData(financeSourcesQueryOptions(connectionId)),
			);
		}
		return Promise.all(requests);
	},
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: OpenFinancePage,
	pendingComponent: RoutePending,
	errorComponent: RouteError,
});

const sourceStatus = (source: FinanceSource | undefined, selected: boolean) => {
	if (source?.failure) return "Indisponível";
	if (source?.consent.state === "active") return "Ativa";
	if (source?.consent.state === "revoked") return "Revogada";
	if (source?.consent.state === "expired") return "Expirada";
	return selected ? "Selecionada" : "Disponível";
};

function OpenFinancePage() {
	const { connectionId } = useConnection();
	const connections = useFinanceConnections();
	const sources = useFinanceSources(connectionId);
	const items = connections.data ?? [];
	const byConnection = new Map(
		(sources.data?.sources ?? []).map((source) => [source.id, source]),
	);
	const error = (connections.error ?? sources.error) as Error | null;

	return (
		<FinancePage
			title="Open Finance"
			description="Conexões e consentimentos consultados diretamente no Pluggy."
		>
			<QueryState loading={connections.isLoading || sources.isLoading} error={error} />
			{items.length === 0 && !connections.isLoading ? (
				<EmptyPanel>
					Nenhuma conexão ativa. Cadastre um provedor nas configurações.
				</EmptyPanel>
			) : (
				<section className="grid grid-cols-3 gap-3 max-wide:grid-cols-2 max-mobile:grid-cols-1">
					{items.map((connection) => {
						const source = byConnection.get(connection.id);
						const selected = connection.id === connectionId;
						const label = sourceStatus(source, selected);
						return (
							<article
								className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-border bg-card p-3.5"
								key={connection.id}
							>
								<span className="grid size-8 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
									<Landmark size={16} />
								</span>
								<div className="grid min-w-0 gap-0.5">
									<strong className="text-[13px] font-medium">
										{source?.institution ?? connection.name}
									</strong>
									<small className="text-xs text-muted-foreground">
										{connection.itemIds.length} consentimentos · ID{" "}
										{connection.id}
									</small>
								</div>
								<i
									className={`${badgeClass} border-[color-mix(in_oklab,var(--brand)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] text-brand`}
								>
									{label}
								</i>
							</article>
						);
					})}
				</section>
			)}
		</FinancePage>
	);
}
