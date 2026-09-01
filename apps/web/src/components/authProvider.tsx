import type { PropsWithChildren } from "react";

import { createContext, use, useMemo } from "react";

import { authClient } from "@/lib/authClient";

type Session = typeof authClient.$Infer.Session;

export interface AuthContextValue {
	isAuthenticated: boolean;
	isPending: boolean;
	session: Session | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
	const { data, isPending } = authClient.useSession();
	const value = useMemo(
		() => ({ isAuthenticated: Boolean(data?.user), isPending, session: data ?? null }),
		[data, isPending],
	);

	return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
	const context = use(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used inside AuthProvider");
	}
	return context;
}
