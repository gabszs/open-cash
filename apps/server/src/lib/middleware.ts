import type { AgentSession } from "@better-auth/agent-auth";

import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import type { AiFeature } from "../db/models/conversations";
import type { AppContextType, AuthAppContextType } from "../types";
import type { AuthSessionData } from "./auth";

import { users } from "../db/models/authModels";
import { AI_FEATURES, conversations } from "../db/models/conversations";
import { ConversationsRepository } from "../features/conversations/repository";
import { ConversationsService } from "../features/conversations/service";
import { httpErrors } from "./errors";

const AI_PATH = "/ai/";

export const authenticateSession = createMiddleware<AuthAppContextType>(async (c, next) => {
	const authBasePath = c.env.AUTH_BASE_PATH ?? "/v1/auth";
	if (c.req.path === authBasePath || c.req.path.startsWith(`${authBasePath}/`)) {
		await next();
		return;
	}
	if (c.req.path === "/mcp") {
		let agentSession: AgentSession | null;
		try {
			agentSession = await c.get("auth").api.getAgentSession({
				headers: c.req.raw.headers,
			});
		} catch {
			throw httpErrors.create("UNAUTHORIZED");
		}
		if (!agentSession?.userId || !agentSession.agent.name.startsWith("finance-")) {
			throw httpErrors.create("UNAUTHORIZED");
		}
		const conversationId = agentSession.agent.name.slice("finance-".length);
		const [row] = await c
			.get("db")
			.select({ connectionId: conversations.connectionId, user: users })
			.from(conversations)
			.innerJoin(users, eq(users.id, conversations.userId))
			.where(eq(conversations.id, conversationId))
			.limit(1);
		if (!row || row.user.id !== agentSession.userId) throw httpErrors.create("UNAUTHORIZED");
		const now = new Date();
		c.set("user", row.user);
		c.set("agentConnectionId", row.connectionId);
		c.set("session", {
			city: null,
			colo: null,
			country: null,
			createdAt: now,
			expiresAt: new Date(Date.now() + 60_000),
			id: `agent-${agentSession.agentId}`,
			impersonatedBy: null,
			ipAddress: null,
			latitude: null,
			longitude: null,
			region: null,
			regionCode: null,
			timezone: null,
			token: "agent-auth",
			updatedAt: now,
			userAgent: "finance-agent",
			userId: row.user.id,
		} as AuthSessionData);
		await next();
		return;
	}
	const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		throw httpErrors.create("UNAUTHORIZED");
	}
	c.set("user", session.user);
	c.set("session", session.session as AuthSessionData);

	await next();
});

const isAiFeature = (value: string): value is AiFeature =>
	(AI_FEATURES as readonly string[]).includes(value);

/**
 * Resolves the conversation a proxied agent request addresses:
 * `/ai/{feature}/{conversationId}[/...]`.
 *
 * Returns null for anything else — a featureless path or an unregistered feature
 * — which the gate below turns into a 404.
 */
export function parseAgentPath(path: string) {
	if (!path.startsWith(AI_PATH)) return null;
	const [feature, conversationId] = path.slice(AI_PATH.length).split("/");
	if (!feature || !isAiFeature(feature) || !conversationId) return null;
	return { conversationId, feature };
}

/**
 * The single ownership gate in front of the agent proxy. Delegates to the
 * conversations service so the database stays the one authority on who owns
 * what, and passing `feature` keeps a conversation minted for one agent from
 * being addressed through another.
 */
export const requireOwnedAgentConversation = createMiddleware<AuthAppContextType>(
	async (c, next) => {
		const parsed = parseAgentPath(c.req.path);
		if (!parsed) throw new Error("CONVERSATION_NOT_FOUND");
		const db = c.get("db");
		const service = new ConversationsService(new ConversationsRepository(db));
		await service.requireOwned(c.get("user").id, parsed.conversationId, parsed.feature);
		await next();
	},
);

export const requireContentType = (allowedContentTypes: string[]) =>
	createMiddleware<AppContextType>(async (c, next) => {
		const contentType = c.req.header("content-type");
		if (!contentType || !allowedContentTypes.some((type) => contentType.includes(type))) {
			throw httpErrors.create("UNSUPPORTED_MEDIA_TYPE", {
				detail: `Content-Type ${contentType ?? "none"} is not supported. Supported types are: ${allowedContentTypes.join(" and ")}`,
			});
		}
		await next();
	});
