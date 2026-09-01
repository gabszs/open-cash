import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/appShell";
import { RoutePending } from "@/components/routePending";
import { requireAuthenticated } from "@/lib/routeGuards";

export const Route = createFileRoute("/_app")({
	beforeLoad: ({ context, location }) =>
		requireAuthenticated({
			authClient: context.authClient,
			redirectTo: location.href,
		}),
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: AppLayout,
	pendingComponent: RoutePending,
	errorComponent: ({ error }) => (
		<p className="p-6 text-[13px] text-destructive">{error.message}</p>
	),
});

function AppLayout() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
