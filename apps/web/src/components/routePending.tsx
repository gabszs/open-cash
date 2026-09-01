import { centeredPageClass } from "@/components/ui/styles";

export function RoutePending() {
	return (
		<main className={centeredPageClass} aria-busy="true" aria-label="Carregando página">
			<div className="size-6 animate-spin rounded-full border-2 border-border border-t-muted-foreground" />
		</main>
	);
}
