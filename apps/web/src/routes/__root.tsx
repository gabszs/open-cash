import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

import type { AuthContextValue } from "@/components/authProvider";
import type { authClient } from "@/lib/authClient";
import type { orpc } from "@/lib/orpc";

import { ErrorBoundary } from "@/components/errorBoundary";
import {
	buttonClass,
	centeredPageClass,
	emptyStateClass,
	eyebrowClass,
} from "@/components/ui/styles";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";
import "@/index.css";

export interface RouterAppContext {
	auth: AuthContextValue;
	authClient: typeof authClient;
	/**
	 * The active connection, mirrored out of ConnectionProvider because loaders run
	 * outside React and cannot read React context. Null means nothing is selected;
	 * `isLoading` is true until settings have been read, and loaders must not
	 * prefetch before then or they cache a page the screen will not show.
	 */
	connection: { connectionId: string | null; isLoading: boolean };
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: RootLayout,
	errorComponent: ErrorBoundary,
	notFoundComponent: () => (
		<main className={centeredPageClass}>
			<div className={emptyStateClass}>
				<p className={eyebrowClass}>404</p>
				<h1>Página não encontrada.</h1>
				<Link className={buttonClass({ className: "mt-2.5" })} to="/">
					Voltar ao início
				</Link>
			</div>
		</main>
	),
});

function RootLayout() {
	return (
		<ToastProvider>
			<Outlet />
			<ToastViewport />
		</ToastProvider>
	);
}
