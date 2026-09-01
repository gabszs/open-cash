import * as Cloudflare from "alchemy/Cloudflare";

import { APP_NAME } from "./utils";

export const DATABASE = Cloudflare.D1.Database(`${APP_NAME}-d1`, {
	name: `${APP_NAME}-d1`,
	migrationsDir: "./apps/server/src/db/migrations",
	migrationsTable: "d1_migrations",
	primaryLocationHint: "wnam",
});
