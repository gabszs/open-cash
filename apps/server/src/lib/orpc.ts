import type { Context as HonoContext } from "hono";

import { ORPCError, os } from "@orpc/server";

import type { dbType } from "../db";
import type { AppContextType } from "../types";
import type { AuthType } from "./auth";

export interface CreateContextOptions {
	context: HonoContext<AppContextType>;
}

export interface OrpcContext {
	session: Awaited<ReturnType<AuthType["api"]["getSession"]>>;
	db: dbType;
	auth: AuthType;
	headers: Headers;
}

export const createContext = async ({ context }: CreateContextOptions) => {
	const auth = context.get("auth");
	const db = context.get("db");
	const session = await auth.api.getSession({ headers: context.req.raw.headers });

	return {
		auth,
		db,
		headers: context.req.raw.headers,
		session,
	};
};

export const publicProcedure = os.$context<OrpcContext>();
export const protectedProcedure = publicProcedure.use(({ context, next }) => {
	if (!context.session) {
		throw new ORPCError("UNAUTHORIZED", {
			cause: "No session",
			message: "authorization required",
		});
	}
	return next({
		context: {
			...context,
			session: context.session,
		},
	});
});

export type Context = Awaited<ReturnType<typeof createContext>>;
export type ProtectedContext = Context & {
	session: NonNullable<Context["session"]>;
};
