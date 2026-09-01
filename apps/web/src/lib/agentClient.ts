import { createFlueClient } from "@flue/sdk";

import { serverUrl } from "./const";

/**
 * A Flue client bound to one conversation. Browsers never reach the Agent Worker
 * directly: `/ai/finance/:id` is the Server route that authenticates the
 * session cookie and forwards to it, hence `credentials: "include"`.
 *
 * Shared by the chat home (which opens the stream with the first message) and the
 * chat route (which observes it), so both agree on URL and credentials.
 */
export const createFinanceAgentClient = (conversationId: string) =>
	createFlueClient({
		url: `${serverUrl}/ai/finance/${conversationId}`,
		fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
	});
