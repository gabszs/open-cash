import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Building2, CreditCard, Landmark } from "lucide-react";

import { useConnection } from "@/components/connectionProvider";
import { ConnectionRequired, EmptyPanel, FinancePage, QueryState } from "@/components/financePage";
import { RouteError } from "@/components/routeError";
import { RoutePending } from "@/components/routePending";
import {
	financeAccountsQueryOptions,
	financeBalanceQueryOptions,
	financeSummaryQueryOptions,
	useFinanceAccounts,
	useFinanceBalance,
	useFinanceSummary,
} from "@/hooks/useFinance";
import { formatMoney } from "@/lib/format";

const metricCardClass =
	"grid min-w-0 gap-2 rounded-lg border border-border bg-card p-4 [&>p]:m-0 [&>p]:text-xs [&>p]:text-muted-foreground [&>strong]:whitespace-nowrap [&>strong]:text-[clamp(18px,2vw,22px)] [&>strong]:font-semibold [&>strong]:tracking-[-0.02em] [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:text-xs [&>span]:text-muted-foreground";
const panelHeadingClass =
	"mb-4.5 flex items-start justify-between gap-3 [&_h2]:mb-0.75 [&_h2]:text-sm [&_h2]:font-medium [&_p]:m-0 [&_p]:text-xs [&_p]:text-muted-foreground";

export const Route = createFileRoute("/_app/overview")({
	// Skips the prefetch until settings are known and a connection is selected —
	// otherwise it caches a page the screen will not show, under the wrong key.
	loader: ({ context }) => {
		const { connectionId, isLoading } = context.connection;
		if (isLoading || connectionId === null) return null;
		return Promise.all([
			context.queryClient.ensureQueryData(financeBalanceQueryOptions(connectionId)),
			context.queryClient.ensureQueryData(financeAccountsQueryOptions(connectionId)),
			context.queryClient.ensureQueryData(financeSummaryQueryOptions(connectionId, 30)),
		]);
	},
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: OverviewPage,
	pendingComponent: RoutePending,
	errorComponent: RouteError,
});

function OverviewPage() {
	// Same connectionId the loader used, or the two would land in different cache entries.
	const { connectionId } = useConnection();
	const balance = useFinanceBalance(connectionId);
	const accounts = useFinanceAccounts(connectionId);
	const summary = useFinanceSummary(connectionId, 30);
	const error = (balance.error ?? accounts.error ?? summary.error) as Error | null;
	const groups = summary.data?.groups ?? [];
	const max = Math.max(...groups.map((item) => Math.abs(Number(item.total))), 1);

	return (
		<FinancePage
			title="Visão geral"
			description="Dados da conexão selecionada, lidos diretamente do Pluggy."
		>
			<ConnectionRequired />
			<QueryState
				loading={balance.isLoading || accounts.isLoading || summary.isLoading}
				error={error}
			/>
			{balance.data && summary.data ? (
				<>
					<section className="mb-3 grid grid-cols-4 gap-3 max-wide:grid-cols-2 max-mobile:grid-cols-1">
						<article
							className={`${metricCardClass} border-transparent bg-primary text-primary-foreground [&>p]:text-[color-mix(in_oklab,var(--primary-foreground)_70%,transparent)] [&>span]:text-[color-mix(in_oklab,var(--primary-foreground)_70%,transparent)]`}
						>
							<p>Saldo disponível</p>
							<strong>{formatMoney(balance.data.cash, balance.data.currency)}</strong>
							<span>
								<Landmark size={13} /> {balance.data.accountsCounted} contas
							</span>
						</article>
						<article className={metricCardClass}>
							<p>Receitas · 30 dias</p>
							<strong>
								{formatMoney(summary.data.received, summary.data.currency)}
							</strong>
							<span className="!text-positive">
								<ArrowUpRight size={13} /> Entradas
							</span>
						</article>
						<article className={metricCardClass}>
							<p>Gastos · 30 dias</p>
							<strong>
								{formatMoney(summary.data.spent, summary.data.currency)}
							</strong>
							<span className="!text-negative">
								<ArrowDownRight size={13} /> Saídas
							</span>
						</article>
						<article className={metricCardClass}>
							<p>Crédito utilizado</p>
							<strong>
								{formatMoney(balance.data.creditUsed, balance.data.currency)}
							</strong>
							<span>
								<CreditCard size={13} /> Faturas
							</span>
						</article>
					</section>
					<section className="grid grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)] gap-3 max-wide:grid-cols-1">
						<article className="min-w-0 rounded-lg border border-border bg-card p-4">
							<div className={panelHeadingClass}>
								<div>
									<h2>Gastos por categoria</h2>
									<p>Últimos 30 dias</p>
								</div>
							</div>
							{groups.length === 0 ? (
								<EmptyPanel>Sem movimentações categorizadas no período.</EmptyPanel>
							) : (
								<div className="grid gap-3.5">
									{groups.slice(0, 8).map((group) => (
										<div
											className="grid grid-cols-[110px_minmax(60px,1fr)_100px] items-center gap-2.5 text-xs max-mobile:grid-cols-[84px_minmax(50px,1fr)_88px]"
											key={group.label}
										>
											<span className="truncate text-muted-foreground">
												{group.label}
											</span>
											<div className="h-1.5 overflow-hidden rounded-full border border-border bg-secondary">
												<i
													className="block h-full rounded-[inherit] bg-brand"
													style={{
														width: `${(Math.abs(Number(group.total)) / max) * 100}%`,
													}}
												/>
											</div>
											<strong className="text-right font-medium">
												{formatMoney(group.total, summary.data.currency)}
											</strong>
										</div>
									))}
								</div>
							)}
						</article>
						<article className="min-w-0 rounded-lg border border-border bg-card p-4">
							<div className={panelHeadingClass}>
								<div>
									<h2>Contas conectadas</h2>
									<p>Saldo por instituição</p>
								</div>
							</div>
							<div className="grid">
								{accounts.data?.accounts.slice(0, 6).map((account) => (
									<div
										className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 [&+&]:border-t [&+&]:border-border"
										key={account.id}
									>
										<span className="grid size-7 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
											<Building2 size={15} />
										</span>
										<div className="grid min-w-0 gap-0.5">
											<strong className="text-[13px] font-medium">
												{account.institution}
											</strong>
											<small className="truncate text-xs text-muted-foreground">
												{account.name}
											</small>
										</div>
										<b className="text-[13px] font-medium">
											{formatMoney(
												account.balance ?? account.usedCredit,
												account.currency,
											)}
										</b>
									</div>
								))}
							</div>
						</article>
					</section>
				</>
			) : null}
		</FinancePage>
	);
}
