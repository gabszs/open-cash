import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { getDb } from "../../src/db";
import { users } from "../../src/db/models/authModels";
import { jsonRequestHeaders, requestApp, responseError } from "./http";

const PASSWORD = "Integration-test-password-123!";

const cookieHeaderFrom = (headers: Headers) =>
	headers
		.getSetCookie()
		.map((cookie) => cookie.slice(0, cookie.indexOf(";")))
		.filter(Boolean)
		.join("; ");

export const uniqueEmail = (prefix: string) => `${prefix}-${crypto.randomUUID()}@integration.test`;

export interface AuthenticatedUser {
	cookie: string;
	email: string;
	name: string;
	password: string;
	userId: string;
}

export const registerUser = async ({
	email = uniqueEmail("user"),
	name = "Integration User",
}: {
	email?: string;
	name?: string;
} = {}) => {
	const response = await requestApp("/v1/auth/sign-up/email", {
		body: JSON.stringify({ email, name, password: PASSWORD }),
		headers: jsonRequestHeaders(),
		method: "POST",
	});
	if (!response.ok) {
		throw await responseError(response);
	}
	const payload = await response.json<{ user: { id: string } }>();
	return { email, name, password: PASSWORD, userId: payload.user.id };
};

export const verifyUserEmail = async (email: string) => {
	const db = getDb(env);
	await db.update(users).set({ emailVerified: true }).where(eq(users.email, email));
};

export const loginUser = async (email: string, password = PASSWORD) => {
	const response = await requestApp("/v1/auth/sign-in/email", {
		body: JSON.stringify({ email, password }),
		headers: jsonRequestHeaders(),
		method: "POST",
	});
	if (!response.ok) {
		throw await responseError(response);
	}

	const cookie = cookieHeaderFrom(response.headers);
	await response.json();
	if (!cookie.includes("session_token")) {
		throw new Error("Better Auth did not return a session cookie.");
	}
	return cookie;
};

export const createAuthenticatedUser = async (
	options: Parameters<typeof registerUser>[0] = {},
): Promise<AuthenticatedUser> => {
	const user = await registerUser(options);
	await verifyUserEmail(user.email);
	const cookie = await loginUser(user.email, user.password);
	return { ...user, cookie };
};
