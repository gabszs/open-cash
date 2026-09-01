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
