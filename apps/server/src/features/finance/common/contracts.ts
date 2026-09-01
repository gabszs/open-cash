export const FINANCE_CAPABILITIES = [
	{ tool: "getAccounts", service: "getAccounts", method: "GET", route: "/finance/accounts" },
	{
		tool: "getBalanceByAccount",
		service: "getBalanceByAccount",
		method: "GET",
		route: "/finance/accounts/{accountId}/balance",
	},
	{ tool: "getBalance", service: "getBalance", method: "GET", route: "/finance/balance" },
	{
		tool: "getTransactions",
		service: "getTransactions",
		method: "GET",
		route: "/finance/transactions/summary",
	},
	{
		tool: "listTransactions",
		service: "listTransactions",
		method: "GET",
		route: "/finance/transactions",
	},
	{
		tool: "getTransactionDetails",
		service: "getTransactionDetails",
		method: "POST",
		route: "/finance/transactions/details",
	},
	{
		tool: "getInvestments",
		service: "getInvestments",
		method: "GET",
		route: "/finance/investments",
	},
	{
		tool: "getBills",
		service: "getBills",
		method: "GET",
		route: "/finance/accounts/{accountId}/bills",
	},
	{
		tool: "getBillSummary",
		service: "getBillSummary",
		method: "GET",
		route: "/finance/accounts/{accountId}/bills/summary",
	},
	{
		tool: "listInstalmentPlans",
		service: "listInstalmentPlans",
		method: "GET",
		route: "/finance/instalment-plans",
	},
	{ tool: "listSources", service: "listSources", method: "GET", route: "/finance/sources" },
] as const;

export const FINANCE_TOOL_NAMES = FINANCE_CAPABILITIES.map(({ tool }) => tool);
