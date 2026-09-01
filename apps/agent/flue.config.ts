import { defineConfig } from "@flue/runtime/config";

export default defineConfig({
	agents: "agents/**/*.ts",
	app: "./src/app.ts",
	cloudflare: "./src/cloudflare.ts",
	// Only the Workers AI binding provider ships; `app.ts` re-registers it to
	// target our named AI Gateway.
	providers: ["cloudflare"],
	target: "cloudflare",
	tracing: true,
});
