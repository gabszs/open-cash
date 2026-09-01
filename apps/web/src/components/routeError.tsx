import type { ErrorComponentProps } from "@tanstack/react-router";

import { AlertCircle } from "lucide-react";

import {
	buttonClass,
	emptyPanelClass,
	pageClass,
	pageContentClass,
	pageScrollClass,
} from "@/components/ui/styles";

/** Page-level error surface so a failed loader never blanks out the shell. */
export function RouteError({ error, reset }: ErrorComponentProps) {
	return (
		<main className={pageClass}>
			<div className={pageScrollClass}>
				<div className={pageContentClass}>
					<div className={emptyPanelClass}>
						<AlertCircle size={20} />
						<strong>Não foi possível carregar esta página.</strong>
						<span>
							{import.meta.env.DEV
								? error.message
								: "Tente novamente em alguns instantes."}
						</span>
						<button
							className={buttonClass({ size: "sm" })}
							type="button"
							onClick={reset}
						>
							Tentar novamente
						</button>
					</div>
				</div>
			</div>
		</main>
	);
}
