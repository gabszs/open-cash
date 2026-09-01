import * as Cloudflare from "alchemy/Cloudflare";
import * as Command from "alchemy/Command";
import * as Config from "effect/Config";

import { AI_GATEWAY } from "../aiGateway";
import { SHARED_KV } from "../kv";
import { R2 } from "../r2";
import { API_URL, APP_NAME } from "../utils";
import { VERSION_METADATA } from "../versionMetadata";

/**
 * Changing this replaces the Worker rather than updating it, which destroys the
 * Durable Objects it hosts — including every Flue conversation stream stored in
 * `FlueFinanceAgentAgent`'s SQLite. Treat it as permanent.
 */
export const AGENT_NAME = `${APP_NAME}-finance-agent`;

/**
 * Flue owns the build, not Alchemy. `vite build` scans the `'use agent'`
 * modules, generates the Worker entry plus one Durable Object class per agent,
 * and writes a runtime-ready ESM bundle (`no_bundle: true`) to
 * `dist/open_cash_finance_agent`.
 * Alchemy only uploads that bundle, so it has to exist before AGENT reconciles
 * — `alchemy.run.ts` yields this first.
 */
export const AGENT_BUILD = Command.Build("AgentBuild", {
	command: "bun run build",
	cwd: "apps/agent",
	outdir: "dist/open_cash_finance_agent",
	// Only these inputs change the bundle; without the narrowing, `dist/` itself
	// would be hashed and the build would never memoize.
	memo: {
		include: ["src/**", "flue.config.ts", "vite.config.ts", "wrangler.jsonc", "package.json"],
	},
});

export const AGENT = Cloudflare.Worker("Agent", {
	name: AGENT_NAME,
	main: "./apps/agent/dist/open_cash_finance_agent/index.js",
	// The Flue output is already a complete Worker bundle. Re-bundling it would
	// rewrite the dynamic imports the runtime depends on, so the entry and its
	// sibling `assets/*.js` chunks are uploaded byte-for-byte.
	bundle: false,
	// No public surface: the agent is reachable only through the API's
	// `AGENT_SERVICE` binding, which is where conversation ownership is enforced.
	url: false,
	compatibility: {
		date: "2026-08-01",
		flags: ["nodejs_compat"],
	},
	observability: {
		enabled: true,
		traces: {
			enabled: true,
			headSamplingRate: 1,
		},
	},
	env: {
		AI: AI_GATEWAY,
		SHARED_KV,
		USER_IDENTITY: Cloudflare.DurableObject("UserIdentity", {
			className: "UserIdentityDO",
		}),
		R2: R2,
		VERSION_METADATA,
		// Class names must match what the prebuilt entry exports: `Sandbox` from
		// `src/cloudflare.ts`, and `FlueFinanceAgentAgent` — the class Flue
		// generates from the `FinanceAgent` function in `src/agents/finance.ts`.
		// Renaming the agent function renames the class, which Alchemy tracks by
		// logical id and turns into a `renamed_classes` migration on its own.
		Sandbox: Cloudflare.DurableObject("Sandbox"),
		FLUE_FINANCE_AGENT_AGENT: Cloudflare.DurableObject("FlueFinanceAgentAgent"),
		FINANCE_MCP_URL: Config.string("FINANCE_MCP_URL").pipe(
			Config.withDefault(`${API_URL}/mcp`),
		),
	},
	dev: {
		port: 8788,
	},
});

export type AgentEnv = Cloudflare.InferEnv<typeof AGENT>;
