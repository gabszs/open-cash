import type { dbType } from "./db";
import type { AuthSessionData, AuthType, AuthUser } from "./lib/auth";

export interface UserIdentityRpc {
	bindHost(hostId: string): Promise<unknown>;
	ensureHost(input: {
		userId: string;
		defaultCapabilities: readonly string[];
	}): Promise<{ hostId: string | null; publicKey: JsonWebKey }>;
}

export interface UserIdentityNamespace {
	getByName(name: string): UserIdentityRpc;
}

export interface AppContextType {
	Variables: {
		auth: AuthType;
		db: dbType;
	};
	Bindings: Env;
}

export interface AuthAppContextType {
	Bindings: AppContextType["Bindings"];
	Variables: AppContextType["Variables"] & {
		user: AuthUser;
		session: AuthSessionData;
		/**
		 * Set only when an agent token authenticated the request: the connection
		 * pinned on that conversation. Undefined for a cookie session, which
		 * resolves its scope from settings instead.
		 */
		agentConnectionId?: string | null;
	};
}
