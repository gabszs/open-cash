import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

function getLocalD1DB() {
	const basePath = path.resolve(".wrangler");
	try {
		const dbFile = fs
			.readdirSync(basePath, { encoding: "utf-8", recursive: true })
			.find((file) => file.endsWith(".sqlite"));
		if (dbFile) return path.resolve(basePath, dbFile);
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
	}

	// `drizzle-kit generate` does not connect to this path. `bun run dev` creates
	// the real local D1 before commands such as Studio need it.
	return path.resolve(basePath, "local-d1.sqlite");
}

export default defineConfig({
	dialect: "sqlite",
	out: "./src/db/migrations",
	// Glob every model file: drizzle-kit reads named table exports, so pointing it at
	// models/index.ts (which only re-exports the `models` object) finds nothing. Listing
	// files one by one drifted once already and made drizzle-kit emit DROP TABLE for
	// every table it could not see.
	schema: "./src/db/models/*.ts",
	...(process.env.ALCHEMY_STAGE === "prod"
		? {
				driver: "d1-http",
				dbCredentials: {
					accountId: process.env.CLOUDFLARE_D1_ACCOUNT_ID ?? "",
					databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
					token: process.env.CLOUDFLARE_D1_API_TOKEN ?? "",
				},
			}
		: { dbCredentials: { url: getLocalD1DB() } }),
});
