import { DurableObject } from "cloudflare:workers";

interface IdentityState {
	hostId: string | null;
	publicKey: JsonWebKey;
}

const publicKey: JsonWebKey = {
	crv: "Ed25519",
	kty: "OKP",
	x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

export class TestUserIdentityDO extends DurableObject {
	private readonly state: IdentityState = {
		hostId: null,
		publicKey,
	};

	async ensureHost(input: { userId: string; defaultCapabilities: readonly string[] }) {
		return {
			defaultCapabilities: [...input.defaultCapabilities],
			hostId: this.state.hostId,
			keyVersion: 1,
			publicKey: this.state.publicKey,
			status: this.state.hostId ? "active" : "pending",
			userId: input.userId,
		};
	}

	async bindHost(hostId: string) {
		this.state.hostId = hostId;
		return {
			defaultCapabilities: [],
			hostId,
			keyVersion: 1,
			publicKey: this.state.publicKey,
			status: "active",
			userId: "test-user",
		};
	}
}
