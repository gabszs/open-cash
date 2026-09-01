import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { exportJWK, generateKeyPair, importJWK, SignJWT } from "jose";

import { identityMigrations } from "../db/doMigrations";
import { agentIdentity, hostIdentity, identitySchema } from "../db/doModels/identity";

type IdentityDb = ReturnType<typeof drizzle<typeof identitySchema>>;
type IdentityStatus = "pending" | "active" | "revoked";

export type IdentityCapabilities = readonly string[];

export interface HostMetadata {
	userId: string;
	hostId: string | null;
	publicKey: JsonWebKey;
	keyVersion: number;
	status: IdentityStatus;
	defaultCapabilities: string[];
}

export interface AgentMetadata {
	conversationId: string;
	agentId: string | null;
	hostId: string;
	publicKey: JsonWebKey;
	status: IdentityStatus;
	capabilities: string[];
}

export interface AgentIdentityState {
	userId: string;
	hostId: string;
	agentId: string;
}

interface HostJwtInput {
	audience: string;
	agentPublicKey: JsonWebKey;
	capabilities: IdentityCapabilities;
}

const json = <T>(value: T) => JSON.stringify(value);
const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const asPublicKey = (value: string) => parseJson<JsonWebKey>(value);
const asCapabilities = (value: string) => parseJson<string[]>(value);

export class UserIdentityDO extends DurableObject<Env> {
	private readonly db: IdentityDb;
	private readonly ready: Promise<void>;
	private readonly agentPromises = new Map<string, Promise<AgentMetadata>>();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.db = drizzle(ctx.storage, { logger: true, schema: identitySchema });
		this.ready = ctx.blockConcurrencyWhile(async () => {
			await migrate(this.db, identityMigrations);
		});
	}

	async ensureHost(input: {
		userId: string;
		defaultCapabilities: IdentityCapabilities;
	}): Promise<HostMetadata> {
		await this.ready;
		const capabilities = [...new Set(input.defaultCapabilities)];
		const existing = await this.db.query.hostIdentity.findFirst();
		if (existing) {
			if (existing.status === "revoked") throw new Error("Host identity is revoked");
			await this.db
				.update(hostIdentity)
				.set({ defaultCapabilities: json(capabilities), updatedAt: new Date() })
				.where(eq(hostIdentity.userId, existing.userId));
			return this.hostMetadata({ ...existing, defaultCapabilities: json(capabilities) });
		}

		// `extractable` é obrigatório: o jose gera a chave como não-extraível por
		// padrão, e a privada precisa virar JWK para ser persistida aqui.
		const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
		const [publicKey, privateKey] = await Promise.all([
			exportJWK(keyPair.publicKey),
			exportJWK(keyPair.privateKey),
		]);
		const { userId } = input;
		await this.db.insert(hostIdentity).values({
			defaultCapabilities: json(capabilities),
			privateKey: json(privateKey),
			publicKey: json(publicKey),
			userId,
		});
		return {
			defaultCapabilities: capabilities,
			hostId: null,
			keyVersion: 1,
			publicKey,
			status: "pending",
			userId,
		};
	}

	async bindHost(hostId: string): Promise<HostMetadata> {
		await this.ready;
		if (!hostId) throw new Error("Host id is required");
		const existing = await this.db.query.hostIdentity.findFirst();
		if (!existing) throw new Error("Host identity not initialized");
		await this.db
			.update(hostIdentity)
			.set({ hostId, status: "active", updatedAt: new Date() })
			.where(eq(hostIdentity.userId, existing.userId));
		return this.hostMetadata({ ...existing, hostId, status: "active" });
	}

	async ensureAgent(
		conversationId: string,
		capabilities: IdentityCapabilities,
	): Promise<AgentMetadata> {
		const inFlight = this.agentPromises.get(conversationId);
		if (inFlight) return await inFlight;
		const promise = this.ensureAgentInternal(conversationId, capabilities);
		this.agentPromises.set(conversationId, promise);
		try {
			return await promise;
		} finally {
			this.agentPromises.delete(conversationId);
		}
	}

	private async ensureAgentInternal(
		conversationId: string,
		capabilities: IdentityCapabilities,
	): Promise<AgentMetadata> {
		await this.ready;
		const existing = await this.db.query.agentIdentity.findFirst({
			where: eq(agentIdentity.conversationId, conversationId),
		});
		if (existing?.agentId && existing.status === "active") return this.agentMetadata(existing);
		if (existing?.status === "revoked") throw new Error("Agent identity is revoked");
		return await this.createAgent(conversationId, capabilities, existing);
	}

	async signHostJwt(input: HostJwtInput): Promise<string> {
		await this.ready;
		const host = await this.db.query.hostIdentity.findFirst();
		if (!host?.hostId || host.status !== "active") {
			throw new Error("Host identity is not ready");
		}
		const privateKey = await importJWK(parseJson<JsonWebKey>(host.privateKey), "EdDSA");
		return await new SignJWT({
			agent_public_key: input.agentPublicKey,
			capabilities: [...input.capabilities],
			host_public_key: asPublicKey(host.publicKey),
		})
			.setProtectedHeader({ alg: "EdDSA", typ: "host+jwt" })
			.setIssuer(host.hostId)
			.setAudience(input.audience)
			.setIssuedAt()
			.setExpirationTime("60s")
			.setJti(crypto.randomUUID())
			.sign(privateKey);
	}

	async signAgentJwt(agentId: string, audience: string): Promise<string> {
		await this.ready;
		const agent = await this.db.query.agentIdentity.findFirst({
			where: eq(agentIdentity.agentId, agentId),
		});
		if (!agent?.agentId || agent.status !== "active") {
			throw new Error("Agent identity is not ready");
		}
		const privateKey = await importJWK(parseJson<JsonWebKey>(agent.privateKey), "EdDSA");
		return await new SignJWT({ capabilities: asCapabilities(agent.capabilities) })
			.setProtectedHeader({ alg: "EdDSA", typ: "agent+jwt" })
			.setIssuer(agent.hostId)
			.setSubject(agent.agentId)
			.setAudience(audience)
			.setIssuedAt()
			.setExpirationTime("60s")
			.setJti(crypto.randomUUID())
			.sign(privateKey);
	}

	async getIdentityMetadata(): Promise<{
		host: HostMetadata | null;
		agents: AgentMetadata[];
	}> {
		await this.ready;
		const [host, agents] = await Promise.all([
			this.db.query.hostIdentity.findFirst(),
			this.db.query.agentIdentity.findMany(),
		]);
		return {
			agents: agents.map((agent) => this.agentMetadata(agent)),
			host: host ? this.hostMetadata(host) : null,
		};
	}

	private async createAgent(
		conversationId: string,
		requestedCapabilities: IdentityCapabilities,
		existing: typeof agentIdentity.$inferSelect | undefined,
	): Promise<AgentMetadata> {
		const host = await this.db.query.hostIdentity.findFirst();
		if (!host?.hostId || host.status !== "active") {
			throw new Error("Host identity is not ready");
		}
		const capabilities = [...new Set(requestedCapabilities)];
		let publicKey: JsonWebKey;
		let privateKey: JsonWebKey;
		if (existing) {
			publicKey = asPublicKey(existing.publicKey);
			privateKey = parseJson<JsonWebKey>(existing.privateKey);
		} else {
			const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
			[publicKey, privateKey] = await Promise.all([
				exportJWK(keyPair.publicKey),
				exportJWK(keyPair.privateKey),
			]);
		}
		const pending = {
			capabilities: json(capabilities),
			conversationId,
			hostId: host.hostId,
			privateKey: json(privateKey),
			publicKey: json(publicKey),
		};
		await (existing
			? this.db
					.update(agentIdentity)
					.set({ capabilities: pending.capabilities, updatedAt: new Date() })
					.where(eq(agentIdentity.conversationId, conversationId))
			: this.db.insert(agentIdentity).values(pending));

		const audience = new URL(this.env.FINANCE_MCP_URL).origin;
		const hostJwt = await this.signHostJwt({
			agentPublicKey: publicKey,
			audience,
			capabilities,
		});
		const response = await fetch(new URL("/v1/auth/agent/register", this.env.FINANCE_MCP_URL), {
			body: JSON.stringify({
				capabilities,
				mode: "delegated",
				name: `finance-${conversationId}`,
			}),
			headers: {
				Authorization: `Bearer ${hostJwt}`,
				"Content-Type": "application/json",
			},
			method: "POST",
		});
		if (!response.ok) {
			const detail = await response.text();
			throw new Error(`Agent Auth registration failed (${response.status}): ${detail}`);
		}
		const registered = (await response.json()) as { agent_id?: string; status?: string };
		if (!registered.agent_id || registered.status !== "active") {
			throw new Error("Agent Auth registration did not activate the agent");
		}
		await this.db
			.update(agentIdentity)
			.set({ agentId: registered.agent_id, status: "active", updatedAt: new Date() })
			.where(eq(agentIdentity.conversationId, conversationId));
		const saved = await this.db.query.agentIdentity.findFirst({
			where: eq(agentIdentity.conversationId, conversationId),
		});
		if (!saved) throw new Error("Agent identity disappeared after registration");
		return this.agentMetadata(saved);
	}

	private hostMetadata(row: typeof hostIdentity.$inferSelect): HostMetadata {
		return {
			defaultCapabilities: asCapabilities(row.defaultCapabilities),
			hostId: row.hostId,
			keyVersion: row.keyVersion,
			publicKey: asPublicKey(row.publicKey),
			status: row.status,
			userId: row.userId,
		};
	}

	private agentMetadata(row: typeof agentIdentity.$inferSelect): AgentMetadata {
		return {
			agentId: row.agentId,
			capabilities: asCapabilities(row.capabilities),
			conversationId: row.conversationId,
			hostId: row.hostId,
			publicKey: asPublicKey(row.publicKey),
			status: row.status,
		};
	}
}
