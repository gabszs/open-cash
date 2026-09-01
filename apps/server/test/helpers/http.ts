import { env } from "cloudflare:workers";
import { testClient } from "hono/testing";

import { app } from "../../src";

export const createHonoTestClient = () => testClient(app, env);

export const requestApp = (path: string, init?: RequestInit) =>
	app.request(new Request(new URL(path, "http://localhost"), init), undefined, env);

export const jsonRequestHeaders = (cookie?: string) => {
	const headers = new Headers({
		"Content-Type": "application/json",
		Origin: "http://localhost",
	});
	if (cookie) {
		headers.set("Cookie", cookie);
	}
	return headers;
};

export const responseError = async (response: Response) =>
	new Error(
		`Expected a successful response, received ${response.status}: ${await response.text()}`,
	);
