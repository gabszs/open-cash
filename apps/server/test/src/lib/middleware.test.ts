import { expect, test } from "bun:test";

import { parseAgentPath } from "../../../src/lib/middleware";

const conversationId = "019318f2-7c41-7a3b-8f2e-1abdcf496130";

test("resolves the conversation a proxied agent path addresses", () => {
	expect(parseAgentPath(`/ai/finance/${conversationId}`)).toEqual({
		conversationId,
		feature: "finance",
	});
	expect(parseAgentPath(`/ai/finance/${conversationId}/messages`)).toEqual({
		conversationId,
		feature: "finance",
	});
});

test("resolves nothing without a registered feature and a conversation", () => {
	expect(parseAgentPath("/ai/finance")).toBeNull();
	expect(parseAgentPath("/ai/health")).toBeNull();
	expect(parseAgentPath(`/ai/analysis/${conversationId}`)).toBeNull();
	expect(parseAgentPath(`/v1/conversations/${conversationId}`)).toBeNull();
});
