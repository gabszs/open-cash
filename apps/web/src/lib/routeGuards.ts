import { redirect } from "@tanstack/react-router";

import type { authClient } from "./authClient";

type AuthClient = typeof authClient;

export async function requireAuthenticated(options: {
	authClient: AuthClient;
	redirectTo: string;
}) {
	const { data: session } = await options.authClient.getSession();
	if (!session) {
		throw redirect({
			to: "/auth/sign-in",
			replace: true,
			search: { redirect: options.redirectTo },
		});
	}
}

export async function redirectIfAuthenticated(options: { authClient: AuthClient; to?: string }) {
	const { data: session } = await options.authClient.getSession();
	if (session) {
		throw redirect({ to: options.to ?? "/chat", replace: true });
	}
}
