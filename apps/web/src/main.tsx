import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode, useMemo } from "react";
import ReactDOM from "react-dom/client";

import { AuthProvider, useAuth } from "@/components/authProvider";
import { ConnectionProvider, useConnection } from "@/components/connectionProvider";
import { ThemeProvider } from "@/components/themeProvider";
import { authClient } from "@/lib/authClient";
import { orpc, queryClient } from "@/lib/orpc";
import { routeTree } from "@/routeTree.gen";

const savedTheme = localStorage.getItem("theme");
document.documentElement.classList.toggle("dark", savedTheme !== "light");

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	context: {
		authClient,
		orpc,
		queryClient,
		auth: { isAuthenticated: false, isPending: true, session: null },
		connection: { connectionId: null, isLoading: true },
	},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function AppRouter() {
	const auth = useAuth();
	const { connectionId, isLoading } = useConnection();
	// The loaders read the connection from here, not from React context.
	const context = useMemo(
		() => ({ auth, authClient, connection: { connectionId, isLoading }, orpc, queryClient }),
		[auth, connectionId, isLoading],
	);
	return <RouterProvider router={router} context={context} />;
}

const element = document.querySelector("#app");
if (!element) {
	throw new Error("Root element not found");
}

ReactDOM.createRoot(element).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<ThemeProvider>
					<ConnectionProvider>
						<AppRouter />
					</ConnectionProvider>
				</ThemeProvider>
			</AuthProvider>
		</QueryClientProvider>
	</StrictMode>,
);
