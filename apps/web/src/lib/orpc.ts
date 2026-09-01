import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "@server/lib/router";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: 1, staleTime: 30_000 },
	},
});

const link = new RPCLink({
	url: `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787"}/orpc`,
	fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
});

export type AppRouterClient = RouterClient<AppRouter>;

export const orpcClient: AppRouterClient = createORPCClient<AppRouterClient>(link);
export const orpc = createTanstackQueryUtils(orpcClient);
