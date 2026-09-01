import type { LucideIcon } from "lucide-react";

import {
	ArrowLeftRight,
	Brain,
	Building2,
	CalendarClock,
	ChartColumn,
	CreditCard,
	FileDown,
	Landmark,
	Receipt,
	TrendingUp,
	Wallet,
	Wrench,
} from "lucide-react";

interface ActionLabel {
	icon: LucideIcon;
	/** Gerúndio, mostrado enquanto a chamada está em voo. */
	running: string;
	/** Particípio, mostrado depois que o resultado chega. */
	done: string;
}

/**
 * Um rótulo em português por ação do agente. As chaves são os nomes de tool
 * exatos declarados em `apps/agent/src/agents/finance.ts` — as 11 do MCP de
 * finanças mais as quatro locais. Um nome fora dessa lista cai no fallback, que
 * mostra o nome cru: é preferível a inventar um rótulo errado.
 */
const catalog: Record<string, ActionLabel> = {
	getAccounts: {
		icon: Landmark,
		running: "Consultando contas",
		done: "Contas consultadas",
	},
	getBalance: {
		icon: Wallet,
		running: "Consultando saldo",
		done: "Saldo consultado",
	},
	getBalanceByAccount: {
		icon: Wallet,
		running: "Consultando saldo por conta",
		done: "Saldos por conta consultados",
	},
	getTransactions: {
		icon: ArrowLeftRight,
		running: "Buscando transações",
		done: "Transações obtidas",
	},
	listTransactions: {
		icon: ArrowLeftRight,
		running: "Listando transações",
		done: "Transações listadas",
	},
	getTransactionDetails: {
		icon: Receipt,
		running: "Abrindo transação",
		done: "Transação detalhada",
	},
	getInvestments: {
		icon: TrendingUp,
		running: "Consultando investimentos",
		done: "Investimentos consultados",
	},
	getBills: {
		icon: CreditCard,
		running: "Consultando faturas",
		done: "Faturas consultadas",
	},
	getBillSummary: {
		icon: CreditCard,
		running: "Resumindo fatura",
		done: "Fatura resumida",
	},
	listInstalmentPlans: {
		icon: CalendarClock,
		running: "Consultando parcelamentos",
		done: "Parcelamentos consultados",
	},
	listSources: {
		icon: Building2,
		running: "Listando instituições",
		done: "Instituições listadas",
	},
	render_finance_chart: {
		icon: ChartColumn,
		running: "Gerando gráfico",
		done: "Gráfico gerado",
	},
	create_finance_file: {
		icon: FileDown,
		running: "Gerando arquivo",
		done: "Arquivo gerado",
	},
	open_file: {
		icon: FileDown,
		running: "Abrindo arquivo",
		done: "Arquivo aberto",
	},
	publish_file: {
		icon: FileDown,
		running: "Publicando arquivo",
		done: "Arquivo publicado",
	},
};

export const reasoningLabel: ActionLabel = {
	icon: Brain,
	running: "Raciocinando",
	done: "Raciocínio",
};

/**
 * MCP tools reach the client namespaced by their connection
 * (`mcp__finance__getAccounts`), while the catalog is keyed by the bare name
 * the agent declares. Without stripping the prefix every finance tool would
 * miss the lookup and fall back to showing its wire name.
 */
export function describeTool(toolName: string): ActionLabel {
	const bare = toolName.replace(/^mcp__[^_]+__/u, "");
	return catalog[bare] ?? { icon: Wrench, running: bare, done: bare };
}

const seconds = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** `240 ms` abaixo de um segundo, `1,2 s` acima. */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)} ms`;
	return `${seconds.format(ms / 1000)} s`;
}
