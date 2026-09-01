import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { AlertCircle, LoaderCircle } from "lucide-react";

import { useConnection } from "@/components/connectionProvider";
import {
	emptyPanelClass,
	eyebrowClass,
	pageClass,
	pageContentClass,
	pageScrollClass,
	pageStateClass,
} from "@/components/ui/styles";

/**
 * The null-connection state every scoped screen shares: alert and zeroed
 * components, with no API call behind it. Renders nothing while settings are still
 * loading, so a screen never flashes the alert before we know the answer.
 */
export function ConnectionRequired() {
	const { connectionId, error, isLoading } = useConnection();
	if (isLoading || connectionId !== null) return null;
	return (
		<div
			className={`${pageStateClass} border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] text-destructive`}
		>
			<AlertCircle size={16} />
			{error ?? (
				<span>
					Nenhuma conexão selecionada. Escolha uma no menu do perfil ou{" "}
					<Link to="/open-finance">conecte um provedor</Link>.
				</span>
			)}
		</div>
	);
}

export function FinancePage({
	title,
	description,
	action,
	children,
}: {
	title: string;
	description: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	const { connectionId } = useConnection();
	return (
		<main className={pageClass}>
			<div className={pageScrollClass}>
				<div className={pageContentClass}>
					<header className="mb-7 flex items-end justify-between gap-6 max-shell:mb-5.5 max-shell:flex-col max-shell:items-start">
						<div>
							<p className={eyebrowClass}>Financeiro</p>
							<h1 className="mb-1.5 text-2xl font-semibold tracking-[-0.02em]">
								{title}
							</h1>
							<p className="m-0 text-[13px] text-muted-foreground">{description}</p>
						</div>
						{action ?? (
							<span
								className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground"
								title={connectionId ?? undefined}
							>
								<span className="size-1.5 rounded-full bg-positive shadow-[0_0_0_3px_color-mix(in_oklab,var(--positive)_20%,transparent)]" />
								{connectionId
									? `Pluggy · ID ${connectionId.slice(0, 8)}`
									: "Dados protegidos"}
							</span>
						)}
					</header>
					{children}
				</div>
			</div>
		</main>
	);
}

export function QueryState({ loading, error }: { loading: boolean; error: Error | null }) {
	if (error) {
		return (
			<div
				className={`${pageStateClass} border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] text-destructive`}
			>
				<AlertCircle size={16} />
				{error.message}
			</div>
		);
	}
	if (loading) {
		return (
			<div className={pageStateClass}>
				<LoaderCircle size={15} className="animate-spin" /> Carregando dados financeiros…
			</div>
		);
	}
	return null;
}

export function EmptyPanel({ children }: { children: ReactNode }) {
	return <div className={emptyPanelClass}>{children}</div>;
}
