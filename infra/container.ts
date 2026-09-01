import * as Cloudflare from "alchemy/Cloudflare";

import { AGENT_NAME } from "./workers/agent";

/**
 * Container image backing the agent's remote sandbox.
 *
 * `@cloudflare/sandbox` ships the `Sandbox` Durable Object class and
 * `apps/agent/src/cloudflare.ts` re-exports it, so the Flue bundle already
 * carries the class. This resource only builds and pushes the image; the link
 * between the application and that class's Durable Object namespace is wired in
 * `alchemy.run.ts`, because the two resources reference each other.
 *
 * `ContainerPlatform` is used instead of the `Cloudflare.Container` sugar: the
 * latter generates its own Durable Object class, which would collide with the
 * `Sandbox` class the Flue bundle exports.
 */
export const AGENT_SANDBOX = Cloudflare.ContainerPlatform("AgentSandbox", {
	name: `${AGENT_NAME}-sandbox`,
	// `dockerfile` is deliberately omitted: the prop is resolved against the
	// process cwd (not against `context`, despite what its docblock says), so
	// passing "Dockerfile" looks for one at the repo root. The default —
	// `<context>/Dockerfile` — resolves to apps/agent/Dockerfile correctly.
	context: "apps/agent",
	instanceType: "lite",
	maxInstances: 2,
});
