import { setProvider } from "@flue/runtime";
import { cloudflareBindingProvider } from "@flue/runtime/cloudflare/workers-ai";
import { createAgentRouter } from "@flue/runtime/routing";
import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { problemDetailsHandler } from "hono-problem-details";
import { showRoutes } from "hono/dev";

import type { AppContextType } from "./types";

import { FinanceAgent } from "./agents/finance";

// Model dispatch goes through the `AI` binding — no API key, no external
// provider account: authorization and billing follow the Worker. This explicit
// registration replaces Flue's generated default only to name our own gateway
// instead of the account's `default` one. Module scope on purpose: `app.ts` is
// evaluated in every Durable Object isolate, so it is in place before any agent
// renders.
setProvider(cloudflareBindingProvider({ binding: env.AI, gateway: { id: "open-cash-gateway" } }));

// No authorization layer here by design: this Worker is reachable only through
// the `AGENT_SERVICE` service binding, and the server's proxy is the single
// place that resolves and enforces conversation ownership against the database.
//
// Conversation files are not served here: the API owns their HTTP surface and
// talks to the same bucket directly. What stays is the agent's own file work,
// which needs the container in-process — see the tools in `agents/finance.ts`.
const app = new Hono<AppContextType>()
	.get("/ai/health", async (c) => c.json({ status: "ok", ...c.env.VERSION_METADATA }, 200))
	.route("/ai/finance", createAgentRouter(FinanceAgent))
	.onError(
		problemDetailsHandler({
			autoInstance: true,
			typePrefix: "https://open-cash.example.com/problems",
		}),
	);

showRoutes(app);

export default app;
