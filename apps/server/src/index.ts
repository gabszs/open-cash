import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Scalar } from "@scalar/hono-api-reference";
import { problemDetailsHandler } from "hono-problem-details";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { showRoutes } from "hono/dev";

import type { AppContextType, AuthAppContextType } from "./types";

import { getDb } from "./db";
import authRouter from "./features/auth/routes";
import connectionsRouter from "./features/connections/routes";
import conversationsRouter from "./features/conversations/routes";
import { handleFinanceMcp } from "./features/finance/mcp";
import financeRouter from "./features/finance/routes";
import utilityRoutes from "./features/utils/routes";
import { createAuth } from "./lib/auth";
import { defaultValidationHook, httpErrors } from "./lib/errors";
import { authenticateSession, requireOwnedAgentConversation } from "./lib/middleware";
import {
	openApiSchema,
	openApiSecurityRequirements,
	openApiSecuritySchemes,
	scalarAuthentication,
	tagDescriptions,
} from "./lib/openapi";
import { createContext } from "./lib/orpc";
import { appRouter } from "./lib/router";

export type { AppRouter, RouterInputs, RouterOutputs } from "./lib/router";

const app = new OpenAPIHono<AppContextType>({
	defaultHook: defaultValidationHook,
})
	.use(
		cors({
			allowHeaders: [
				"Content-Type",
				"Authorization",
				"traceparent",
				"tracestate",
				"baggage",
				"x-client-ip",
				"cf-connecting-ip",
				"x-forwarded-for",
				"x-filename",
				"x-file-metadata",
				"x-finance-connection-id",
				"Stream-Next-Offset",
				"Stream-Up-To-Date",
				"Location",
				"MCP-Protocol-Version",
				"Mcp-Method",
				"Mcp-Name",
			],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			credentials: true,
			exposeHeaders: ["Stream-Next-Offset", "Stream-Up-To-Date", "Location"],
			maxAge: 86_400, // 24 hours
			origin: (origin, c: Context<AppContextType>) =>
				(c.env.CORS_ORIGIN ?? "http://localhost:5055")
					.split(",")
					.map((allowedOrigin: string) => allowedOrigin.trim())
					.includes(origin)
					? origin
					: null,
		}),
	)
	.on(
		"ALL",
		["/v1/*", "/ai/*", "/orpc/*", "/orpc-openapi/*", "/mcp"],
		rateLimiter<AppContextType>({
			binding: (c) => c.env.RATE_LIMIT,
			keyGenerator: (c) => c.req.header("cf-connecting-ip") ?? "",
			handler: () => {
				throw httpErrors.create("TOO_MANY_REQUESTS");
			},
		}),
	)
	.on("ALL", ["/v1/*", "/ai/*", "/orpc/*", "/orpc-openapi/*", "/mcp"], async (c, next) => {
		const db = getDb(c.env);
		c.set("db", db);
		c.set("auth", createAuth(c));
		await next();
	})
	.on("ALL", ["/v1/*", "/ai/*", "/orpc/*", "/orpc-openapi/*", "/mcp"], authenticateSession)
	.route("/v1", authRouter)
	.route("/v1", connectionsRouter)
	.route("/v1", conversationsRouter)
	.route("/v1", financeRouter)
	.route("/", utilityRoutes)
	.onError(
		problemDetailsHandler({
			autoInstance: true,
			mapError: (error) => {
				const mapped = httpErrors.fromMessage(error.message);
				if (mapped) return mapped;
				console.error(error);
				return httpErrors.create("INTERNAL_SERVER_ERROR").problemDetails;
			},
		}),
	);

const rpcHandler = new RPCHandler(appRouter);
const openApiHandler = new OpenAPIHandler(appRouter);

export { app };

app.use("/orpc/*", async (c) => {
	try {
		const { matched, response } = await rpcHandler.handle(c.req.raw, {
			context: await createContext({ context: c }),
			prefix: "/orpc",
		});

		if (!matched || !response) {
			return c.notFound();
		}
		return response;
	} catch (error) {
		console.log(error);
		throw error;
	}
});

app.use("/orpc-openapi/*", async (c) => {
	const { matched, response } = await openApiHandler.handle(c.req.raw, {
		context: await createContext({ context: c }),
		prefix: "/orpc-openapi",
	});

	if (!matched || !response) {
		return c.notFound();
	}
	return response;
});

// Documentation routes are registered once and enabled per request from c.env.
const orpcOpenApiGenerator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()],
});
const orpcOpenApiDocument = await orpcOpenApiGenerator.generate(appRouter, {
	components: {
		securitySchemes: openApiSecuritySchemes,
	},
	info: {
		description: "Personal finance REST surface generated from the oRPC router.",
		title: "open-cash API",
		version: openApiSchema.info.version,
	},
	security: openApiSecurityRequirements,
	servers: [{ url: "/orpc-openapi" }],
	tags: [
		{
			description: "Authenticated user profile operations exposed through oRPC.",
			name: "Profile",
		},
		{
			description: "Authenticated user settings operations exposed through oRPC.",
			name: "Settings",
		},
	],
});

// Private AI proxy: authorize the conversation, then hand the request to the agent
// // Worker untouched apart from the internal user header. Which agent answers is
// // decided by the agent app itself, not here. Registered outside the builder chain
// // (like /mcp below) because a chained `.use` would widen this app's Env and break
// // the oRPC handlers above.
app.use("/ai/*", requireOwnedAgentConversation);
app.all("/ai/*", async (c: Context<AuthAppContextType>) => {
	const headers = new Headers(c.req.raw.headers);
	headers.delete("authorization");
	headers.delete("cookie");
	headers.delete("cf-access-jwt-assertion");

	return await c.env.AGENT_SERVICE.fetch(new Request(c.req.raw, { headers }));
});

app.all("/mcp", handleFinanceMcp);

// @ts-expect-error OpenAPIHono exposes doc at runtime, but the chained Hono type can erase it.
app.doc("/open-api.json", {
	...openApiSchema,
	tags: tagDescriptions,
});
app.get("/open-api/orpc.json", (c) => c.json(orpcOpenApiDocument));
app.get(
	"/docs",
	Scalar<AppContextType>((c) => ({
		authentication: scalarAuthentication,
		metaData: {
			description: "open-cash personal finance API documentation",
			title: "open-cash docs",
		},
		pageTitle: "Open Cash Documentation",
		sources: [
			{ title: "API", url: "/open-api.json" },
			{ title: "oRPC", url: "/open-api/orpc.json" },
			{
				title: "Authentication",
				url: `${new URL(c.req.url).origin}${c.env.AUTH_BASE_PATH}/open-api/generate-schema`,
			},
		],
		theme: c.env.SCALAR_THEME ?? "deepSpace",
	})),
);

showRoutes(app);
export type AppType = typeof app;
export default {
	fetch: app.fetch,
};
