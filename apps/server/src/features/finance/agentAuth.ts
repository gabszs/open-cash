import type { Capability } from "@better-auth/agent-auth";

/**
 * Agent Auth capability ids are deliberately the same as the read-only MCP
 * tool names. The host owns the whole finance read surface; individual agents
 * receive the exact same bounded set.
 */
export const financeAgentCapabilities = [
	{ name: "getAccounts", description: "List the user's finance accounts." },
	{ name: "getBalanceByAccount", description: "Read one owned account's balance." },
	{ name: "getBalance", description: "Read the user's consolidated balance." },
	{ name: "getTransactions", description: "Read transactions over a date range." },
	{ name: "listTransactions", description: "List paginated transactions." },
	{ name: "getTransactionDetails", description: "Read details for owned transactions." },
	{ name: "getInvestments", description: "Read active investment positions." },
	{ name: "getBills", description: "Read credit-card statements." },
	{ name: "getBillSummary", description: "Read the current card-cycle summary." },
	{ name: "listInstalmentPlans", description: "Read active instalment plans." },
	{ name: "listSources", description: "Read finance connection status." },
] satisfies Capability[];

export const financeAgentCapabilityIds = financeAgentCapabilities.map(({ name }) => name);
