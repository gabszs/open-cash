import { describe, expect, test } from "bun:test";

import type { FinanceService } from "../../../../src/features/finance/service";

import { FINANCE_TOOL_NAMES } from "../../../../src/features/finance/common/contracts";
import {
	financeMcpHandler,
	MCP_CACHE_TTL_MS,
	MCP_PROTOCOL_VERSION,
} from "../../../../src/features/finance/mcp";

const clientEnvelope = {
	"io.modelcontextprotocol/clientCapabilities": {},
	"io.modelcontextprotocol/clientInfo": { name: "finance-test", version: "1.0.0" },
	"io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
};

function mcpRequest(request: RequestInit, finance?: FinanceService, userId = "user-id") {
	const options = finance
		? {
				authInfo: {
					token: "test-token",
					clientId: "finance-test",
					scopes: ["finance:read"],
					extra: { finance, userId },
				},
			}
		: {};

	return financeMcpHandler.fetch(new Request("http://test.local/mcp", request), options);
}

function modernRequest(method: string, params: Record<string, unknown> = {}, name?: string) {
	const headers: Record<string, string> = {
		accept: "application/json, text/event-stream",
		"content-type": "application/json",
		"mcp-method": method,
		"mcp-protocol-version": MCP_PROTOCOL_VERSION,
	};
	if (name) headers["mcp-name"] = name;

	return {
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params: { ...params, _meta: clientEnvelope },
		}),
		headers,
		method: "POST",
	};
}

describe("MCP transport", () => {
	test("serves 2026-07-28 discovery without creating a transport session", async () => {
		const response = await mcpRequest(modernRequest("server/discover"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(response.headers.get("mcp-session-id")).toBeNull();

		const payload = (await response.json()) as {
			result?: {
				_meta?: {
					"io.modelcontextprotocol/serverInfo"?: { name?: string; version?: string };
				};
				cacheScope?: string;
				capabilities?: { tools?: { listChanged?: boolean } };
				supportedVersions?: string[];
				ttlMs?: number;
			};
		};
		expect(payload.result?.supportedVersions).toContain(MCP_PROTOCOL_VERSION);
		expect(payload.result?.capabilities?.tools?.listChanged).toBe(false);
		expect(payload.result?._meta?.["io.modelcontextprotocol/serverInfo"]).toEqual({
			name: "open-cash-finance",
			version: "2.0.0",
		});
		expect(payload.result?.ttlMs).toBe(MCP_CACHE_TTL_MS);
		expect(payload.result?.cacheScope).toBe("private");
	});

	test("keeps stateless compatibility with a 2025 initialize request", async () => {
		const response = await mcpRequest({
			method: "POST",
			headers: {
				accept: "application/json, text/event-stream",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "legacy-test", version: "1.0.0" },
				},
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("mcp-session-id")).toBeNull();
		const body = await response.text();
		expect(body).toContain('"name":"open-cash-finance"');
		expect(body).toContain('"protocolVersion":"2025-06-18"');
	});

	test("rejects 2026 requests whose routing headers disagree with the body", async () => {
		const request = modernRequest(
			"tools/call",
			{ arguments: {}, name: "getAccounts" },
			"getBalance",
		);
		const response = await mcpRequest(request);

		expect(response.status).toBe(400);
		const payload = (await response.json()) as { error?: { code?: number } };
		expect(payload.error?.code).toBe(-32_020);
	});
});

describe("Finance MCP contract", () => {
	test("tools/list exposes exactly the eleven read-only tools with a private cache hint", async () => {
		const response = await mcpRequest(modernRequest("tools/list"));

		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			result?: {
				cacheScope?: string;
				tools?: {
					annotations?: {
						destructiveHint?: boolean;
						idempotentHint?: boolean;
						readOnlyHint?: boolean;
					};
					name: string;
				}[];
				ttlMs?: number;
			};
		};
		expect(payload.result?.tools?.map(({ name }) => name)).toEqual(FINANCE_TOOL_NAMES);
		expect(payload.result?.tools?.every(({ annotations }) => annotations?.readOnlyHint)).toBe(
			true,
		);
		expect(
			payload.result?.tools?.every(
				({ annotations }) =>
					annotations?.destructiveHint === false && annotations.idempotentHint === true,
			),
		).toBe(true);
		expect(payload.result?.ttlMs).toBe(MCP_CACHE_TTL_MS);
		expect(payload.result?.cacheScope).toBe("private");
	});

	test("reads the finance context from each request without sharing users", async () => {
		const first = {
			getAccounts: (userId: string) => Promise.resolve({ source: "first", userId }),
		} as unknown as FinanceService;
		const second = {
			getAccounts: (userId: string) => Promise.resolve({ source: "second", userId }),
		} as unknown as FinanceService;

		const [firstResponse, secondResponse] = await Promise.all([
			mcpRequest(
				modernRequest("tools/call", { arguments: {}, name: "getAccounts" }, "getAccounts"),
				first,
				"first-user",
			),
			mcpRequest(
				modernRequest("tools/call", { arguments: {}, name: "getAccounts" }, "getAccounts"),
				second,
				"second-user",
			),
		]);

		const firstPayload = (await firstResponse.json()) as {
			result?: { structuredContent?: { source?: string; userId?: string } };
		};
		const secondPayload = (await secondResponse.json()) as {
			result?: { structuredContent?: { source?: string; userId?: string } };
		};

		expect(firstPayload.result?.structuredContent).toEqual({
			source: "first",
			userId: "first-user",
		});
		expect(secondPayload.result?.structuredContent).toEqual({
			source: "second",
			userId: "second-user",
		});
	});

	test("fails closed when a tool request has no Finance context", async () => {
		const response = await mcpRequest(
			modernRequest("tools/call", { arguments: {}, name: "getAccounts" }, "getAccounts"),
		);

		expect(await response.text()).toContain("MCP_FINANCE_CONTEXT_MISSING");
	});
});
