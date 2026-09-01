import type { ServerContext } from "@modelcontextprotocol/server";
import type { AuthAppContextType } from "@server/types";
import type { Context } from "hono";

import { createMcpHandler, McpServer, preloadSchemas } from "@modelcontextprotocol/server";
import { resolveConnectionScope } from "@server/lib/connectionScope";

import { kvTokenCache } from "./pluggy/tokenCache";
import { FinanceRepository } from "./repository";
import {
	accountPathSchema,
	billsQuerySchema,
	instalmentPlansQuerySchema,
	investmentsQuerySchema,
	listTransactionsSchema,
	transactionDetailsInputSchema,
	transactionFiltersSchema,
} from "./schemas";
import { FinanceService } from "./service";

const MCP_CACHE_TTL_MS = 5 * 60 * 1000;
const MCP_PROTOCOL_VERSION = "2026-07-28";
const READ_ONLY_TOOL_ANNOTATIONS = {
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: true,
	readOnlyHint: true,
} as const;

// Build the v2 wire schemas during isolate initialization instead of charging
// the first MCP request handled by each Worker isolate.
preloadSchemas();

const result = (value: object) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value) }],
	structuredContent: value,
});
const run = async (operation: () => Promise<object>) => {
	try {
		return result(await operation());
	} catch (error) {
		const message = error instanceof Error ? error.message : "Finance operation failed";
		return { ...result({ error: message }), isError: true };
	}
};

const descriptions = {
	getAccounts: "Lists every account across the authenticated user's configured bank connections.",
	getBalanceByAccount: "Gets the current figures and details for one owned account.",
	getBalance: "Gets consolidated figures without mixing cash and credit used.",
	getTransactions: "Totals spending and income over a date range, grouped by category.",
	listTransactions: "Lists a stable, cursor-paginated page of transactions.",
	getTransactionDetails: "Returns full details for one to twenty transaction ids.",
	getInvestments: "Lists active investment positions with currency totals and cursor pagination.",
	getBills: "Lists credit-card statements newest first.",
	getBillSummary:
		"Returns independent posted and committed estimates for the current card cycle.",
	listInstalmentPlans: "Lists credit-card purchases still being paid in instalments.",
	listSources: "Diagnoses configured bank connections and consent state.",
} as const;

interface FinanceMcpRequestContext {
	finance: FinanceService;
	userId: string;
}

function getFinanceContext(context: ServerContext): FinanceMcpRequestContext {
	const extra = context.http?.authInfo?.extra;
	const finance = extra?.finance;
	const userId = extra?.userId;

	if (!extra || typeof userId !== "string" || !finance || typeof finance !== "object") {
		throw new Error("MCP_FINANCE_CONTEXT_MISSING");
	}

	return { finance: finance as FinanceService, userId };
}

export function createFinanceMcpServer() {
	const server = new McpServer(
		{ name: "open-cash-finance", version: "2.0.0" },
		{
			cacheHints: {
				"server/discover": { cacheScope: "private", ttlMs: MCP_CACHE_TTL_MS },
				"tools/list": { cacheScope: "private", ttlMs: MCP_CACHE_TTL_MS },
			},
			capabilities: { tools: { listChanged: false } },
			instructions:
				"Read-only access to the authenticated user's Open Finance accounts, balances, transactions, investments, bills, instalments, and connection status.",
		},
	);
	server.registerTool(
		"getAccounts",
		{ annotations: READ_ONLY_TOOL_ANNOTATIONS, description: descriptions.getAccounts },
		async (context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getAccounts(userId));
		},
	);
	server.registerTool(
		"getBalanceByAccount",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.getBalanceByAccount,
			inputSchema: accountPathSchema,
		},
		async ({ accountId }, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getBalanceByAccount(userId, accountId));
		},
	);
	server.registerTool(
		"getBalance",
		{ annotations: READ_ONLY_TOOL_ANNOTATIONS, description: descriptions.getBalance },
		async (context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getBalance(userId));
		},
	);
	server.registerTool(
		"getTransactions",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.getTransactions,
			inputSchema: transactionFiltersSchema,
		},
		async (input, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getTransactions(userId, input));
		},
	);
	server.registerTool(
		"listTransactions",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.listTransactions,
			inputSchema: listTransactionsSchema,
		},
		async (input, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.listTransactions(userId, input));
		},
	);
	server.registerTool(
		"getTransactionDetails",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.getTransactionDetails,
			inputSchema: transactionDetailsInputSchema,
		},
		async ({ ids }, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getTransactionDetails(userId, ids));
		},
	);
	server.registerTool(
		"getInvestments",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.getInvestments,
			inputSchema: investmentsQuerySchema,
		},
		async (input, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getInvestments(userId, input));
		},
	);
	server.registerTool(
		"getBills",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.getBills,
			inputSchema: accountPathSchema.extend(billsQuerySchema.shape),
		},
		async ({ accountId, limit }, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getBills(userId, accountId, limit));
		},
	);
	server.registerTool(
		"getBillSummary",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.getBillSummary,
			inputSchema: accountPathSchema,
		},
		async ({ accountId }, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.getBillSummary(userId, accountId));
		},
	);
	server.registerTool(
		"listInstalmentPlans",
		{
			annotations: READ_ONLY_TOOL_ANNOTATIONS,
			description: descriptions.listInstalmentPlans,
			inputSchema: instalmentPlansQuerySchema,
		},
		async (input, context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.listInstalmentPlans(userId, input));
		},
	);
	server.registerTool(
		"listSources",
		{ annotations: READ_ONLY_TOOL_ANNOTATIONS, description: descriptions.listSources },
		async (context) => {
			const { finance, userId } = getFinanceContext(context);
			return run(() => finance.listSources(userId));
		},
	);

	return server;
}

export const financeMcpHandler = createMcpHandler(() => createFinanceMcpServer(), {
	legacy: "stateless",
	responseMode: "auto",
});

/**
 * The agent uses the connection pinned on its conversation (it runs durably and
 * must not follow a selection that moved on). An unset scope reads as zero rows,
 * never as every connection.
 */
export async function handleFinanceMcp(context: Context<AuthAppContextType>) {
	const db = context.get("db");
	const agentConnectionId = context.get("agentConnectionId");
	const connectionId =
		agentConnectionId === undefined
			? await resolveConnectionScope(db, context.get("user").id)
			: agentConnectionId;
	const finance = new FinanceService(
		new FinanceRepository(db, connectionId),
		context.env.FINANCE_ENCRYPTION_KEY,
		context.env.CACHE
			? kvTokenCache(context.env.CACHE, context.env.FINANCE_ENCRYPTION_KEY)
			: undefined,
	);
	return financeMcpHandler.fetch(context.req.raw, {
		authInfo: {
			token: "internal-finance",
			clientId: "open-cash-server",
			scopes: ["finance:read"],
			extra: {
				finance,
				userId: context.get("user").id,
			},
		},
	});
}

export { MCP_CACHE_TTL_MS, MCP_PROTOCOL_VERSION };
