import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Command from "alchemy/Command";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { AI_GATEWAY, LOW_BUDGET_ROUTE } from "./infra/aiGateway";
import { AGENT_SANDBOX } from "./infra/container";
import { DATABASE } from "./infra/d1";
import { CACHE, SHARED_KV } from "./infra/kv";
import { R2 } from "./infra/r2";
import { APP_NAME } from "./infra/utils";
import { AGENT, AGENT_BUILD } from "./infra/workers/agent";
import { API, OPTIONAL_SECRETS } from "./infra/workers/api";
import { WEB } from "./infra/workers/web";
import { WranglerJsoncFileProvider, writeWranglerJsoncFromWorker } from "./infra/wrangler";

export default Alchemy.Stack(
	APP_NAME,
	{
		providers: Layer.mergeAll(
			Cloudflare.providers(),
			Command.providers(),
			WranglerJsoncFileProvider(),
		),
		state: Cloudflare.state(),
	},
	Effect.gen(function* () {
		const database = yield* DATABASE;
		const cache = yield* CACHE;
		const sharedKv = yield* SHARED_KV;
		const r2 = yield* R2;
		const aiGateway = yield* AI_GATEWAY;
		yield* LOW_BUDGET_ROUTE(aiGateway.gatewayId);

		// Flue's `vite build` has to run before the Worker upload: Alchemy ships
		// `dist/open_cash_finance_agent/index.js` as-is rather than bundling
		// `src/app.ts`.
		yield* AGENT_BUILD;

		const agent_worker = yield* AGENT;
		const sandbox = yield* AGENT_SANDBOX;

		// Cloudflare links a container application to the Durable Object namespace
		// that fronts it, and the Worker's upload metadata has to mark the class as
		// container-backed. The two references form a cycle, which Alchemy resolves
		// by pre-creating the Worker so the `Sandbox` namespace id exists before the
		// container application reconciles.
		yield* sandbox.bind`Sandbox`({
			durableObjects: {
				namespaceId: agent_worker.durableObjectNamespaces.pipe(
					Output.map((namespaces) => namespaces.Sandbox as string),
				),
			},
		});
		yield* agent_worker.bind`AgentSandbox`({
			containers: [{ className: "Sandbox", dev: sandbox.dev }],
		});

		const api_worker = yield* API;
		const web_worker = yield* WEB;

		// Mirrors the API's bindings into a Wrangler config so `wrangler dev` and
		// `wrangler d1 migrations apply` work against the same resources Alchemy
		// provisioned. Alchemy stays the source of truth; this file is generated.
		yield* writeWranglerJsoncFromWorker("ServerWrangler", {
			worker: api_worker,
			path: "apps/server/wrangler.jsonc",
			// Social login credentials are bound only where they exist, so the names
			// have to be declared here or `wrangler types` would drop them from `Env`
			// on every machine that runs without them.
			optionalSecrets: OPTIONAL_SECRETS,
		});

		return {
			appName: APP_NAME,
			webUrl: web_worker.url,
			apiUrl: api_worker.url,
			agentWorkerName: agent_worker.workerName,
			databaseName: database.databaseName,
			databaseId: database.databaseId,
			bucketName: r2.bucketName,
			cacheNamespaceId: cache.namespaceId,
			sharedKvNamespaceId: sharedKv.namespaceId,
			aiGatewayId: aiGateway.gatewayId,
		};
	}),
);
