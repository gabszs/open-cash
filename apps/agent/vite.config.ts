import { cloudflare } from "@cloudflare/vite-plugin";
import { flue, flueWorkerConfig } from "@flue/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		flue(),
		cloudflare({
			config: flueWorkerConfig(),
			// API and Agent run as separate local processes. Point both at the same
			// persistence root so SHARED_KV is actually shared during dev.
			persistState: { path: "../../.wrangler/dev-shared" },
		}),
	],
	server: { port: 8788 },
});
