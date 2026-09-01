import type { ErrorComponentProps } from "@tanstack/react-router";

import {
	buttonClass,
	centeredPageClass,
	emptyStateClass,
	eyebrowClass,
} from "@/components/ui/styles";

export function ErrorBoundary({ error, reset }: ErrorComponentProps) {
	return (
		<main className={centeredPageClass}>
			<div className={emptyStateClass}>
				<p className={eyebrowClass}>Algo saiu do esperado</p>
				<h1>Não foi possível abrir esta página.</h1>
				<p>
					{import.meta.env.DEV ? error.message : "Tente novamente em alguns instantes."}
				</p>
				<button
					className={buttonClass({ className: "mt-2.5" })}
					type="button"
					onClick={reset}
				>
					Tentar novamente
				</button>
			</div>
		</main>
	);
}
