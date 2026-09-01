import { drizzle } from "drizzle-orm/d1";

import { models } from "./models";

/**
 * Creates a lightweight Drizzle handle over the request's D1 binding.
 */
export const getDb = (env: Env) =>
	drizzle(env.DATABASE, {
		casing: "snake_case",
		schema: models,
	});

export type D1Db = ReturnType<typeof getDb>;
export type dbType = D1Db;
