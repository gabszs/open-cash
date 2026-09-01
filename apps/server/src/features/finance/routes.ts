import type { AuthAppContextType } from "@server/types";

import { $, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { cookieAuthorizationSchema } from "@server/common/schemas/baseSchemas";
import { resolveConnectionScope } from "@server/lib/connectionScope";
import { ContentTypes, status } from "@server/lib/constants";
import { httpErrors } from "@server/lib/errors";
import { createMiddleware } from "hono/factory";

import { kvTokenCache } from "./pluggy/tokenCache";
import { FinanceRepository } from "./repository";
import {
	accountPathSchema,
	accountsResponseSchema,
	balanceResponseSchema,
	billSummaryResponseSchema,
	billsQuerySchema,
	billsResponseSchema,
	financeAccountSchema,
	instalmentPlansQuerySchema,
	instalmentPlansResponseSchema,
	investmentsQuerySchema,
	investmentsResponseSchema,
	listTransactionsResponseSchema,
	listTransactionsSchema,
	sourcesResponseSchema,
	transactionDetailsInputSchema,
	transactionDetailsResponseSchema,
	transactionFiltersSchema,
	transactionsSummaryResponseSchema,
} from "./schemas";
import { FinanceService } from "./service";

type FinanceContext = AuthAppContextType & {
	Variables: AuthAppContextType["Variables"] & { finance: FinanceService };
};

/**
 * Resolves the active connection and hands it to the repository constructor.
 * Repository and service are built per request, so the scope rides in there and
 * individual route handlers stay focused on transport concerns.
 *
 * Kept inside this one middleware rather than chained as a second `.use()`:
 * chaining on the OpenAPIHono widens the Env for every handler registered
 * afterwards and breaks the oRPC ones.
 */
const financeContext = createMiddleware<FinanceContext>(async (c, next) => {
	const db = c.get("db");
	const userId = c.get("user").id;
	const connectionId = await resolveConnectionScope(db, userId);
	const requestedConnectionId = c.req.header("x-finance-connection-id");
	// The browser identifies the selection it rendered, while user settings remain
	// authoritative. Rejecting a mismatch prevents a response from another tab's
	// selection from landing under the wrong React Query cache key.
	if (requestedConnectionId && requestedConnectionId !== connectionId) {
		throw new Error("FINANCE_CONNECTION_NOT_FOUND");
	}
	c.set(
		"finance",
		new FinanceService(
			new FinanceRepository(db, connectionId),
			c.env.FINANCE_ENCRYPTION_KEY,
			c.env.CACHE ? kvTokenCache(c.env.CACHE, c.env.FINANCE_ENCRYPTION_KEY) : undefined,
		),
	);
	await next();
});

const errors = () =>
	httpErrors.responses(
		"VALIDATION_FAILED",
		"UNAUTHORIZED",
		"FINANCE_CONNECTION_NOT_FOUND",
		"FINANCE_ACCOUNT_NOT_FOUND",
		"FINANCE_TRANSACTION_NOT_FOUND",
		"FINANCE_INVALID_CURSOR",
		"FINANCE_INVALID_DOCUMENT",
		"FINANCE_ACCOUNT_TYPE_INVALID",
		"FINANCE_MIXED_CURRENCIES",
		"PLUGGY_UNAVAILABLE",
		"TOO_MANY_REQUESTS",
		"INTERNAL_SERVER_ERROR",
	);

const financeRouter = $(new OpenAPIHono<FinanceContext>().use(financeContext))
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/sources",
			tags: ["Finance"],
			summary: "List connection and consent status",
			request: { headers: cookieAuthorizationSchema },
			responses: { [status.OK.code]: status.OK.response(sourcesResponseSchema), ...errors() },
		}),
		async (c) => c.json(await c.get("finance").listSources(c.get("user").id), 200),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/accounts",
			tags: ["Finance"],
			summary: "List accounts",
			request: { headers: cookieAuthorizationSchema },
			responses: {
				[status.OK.code]: status.OK.response(accountsResponseSchema),
				...errors(),
			},
		}),
		async (c) => c.json(await c.get("finance").getAccounts(c.get("user").id), 200),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/accounts/{accountId}/balance",
			tags: ["Finance"],
			summary: "Get balance for one account",
			request: { headers: cookieAuthorizationSchema, params: accountPathSchema },
			responses: { [status.OK.code]: status.OK.response(financeAccountSchema), ...errors() },
		}),
		async (c) =>
			c.json(
				await c
					.get("finance")
					.getBalanceByAccount(c.get("user").id, c.req.valid("param").accountId),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/balance",
			tags: ["Finance"],
			summary: "Get consolidated balance",
			request: { headers: cookieAuthorizationSchema },
			responses: { [status.OK.code]: status.OK.response(balanceResponseSchema), ...errors() },
		}),
		async (c) => c.json(await c.get("finance").getBalance(c.get("user").id), 200),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/transactions/summary",
			tags: ["Finance"],
			summary: "Aggregate transactions",
			request: { headers: cookieAuthorizationSchema, query: transactionFiltersSchema },
			responses: {
				[status.OK.code]: status.OK.response(transactionsSummaryResponseSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await c.get("finance").getTransactions(c.get("user").id, c.req.valid("query")),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/transactions",
			tags: ["Finance"],
			summary: "List transactions",
			request: { headers: cookieAuthorizationSchema, query: listTransactionsSchema },
			responses: {
				[status.OK.code]: status.OK.response(listTransactionsResponseSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await c.get("finance").listTransactions(c.get("user").id, c.req.valid("query")),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "post",
			path: "/finance/transactions/details",
			tags: ["Finance"],
			summary: "Get transaction details",
			request: {
				headers: cookieAuthorizationSchema,
				body: {
					content: { [ContentTypes.JSON]: { schema: transactionDetailsInputSchema } },
				},
			},
			responses: {
				[status.OK.code]: status.OK.response(transactionDetailsResponseSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await c
					.get("finance")
					.getTransactionDetails(c.get("user").id, c.req.valid("json").ids),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/accounts/{accountId}/bills",
			tags: ["Finance"],
			summary: "List credit-card bills",
			request: {
				headers: cookieAuthorizationSchema,
				params: accountPathSchema,
				query: billsQuerySchema,
			},
			responses: { [status.OK.code]: status.OK.response(billsResponseSchema), ...errors() },
		}),
		async (c) =>
			c.json(
				await c
					.get("finance")
					.getBills(
						c.get("user").id,
						c.req.valid("param").accountId,
						c.req.valid("query").limit,
					),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/accounts/{accountId}/bills/summary",
			tags: ["Finance"],
			summary: "Summarize current bill",
			request: { headers: cookieAuthorizationSchema, params: accountPathSchema },
			responses: {
				[status.OK.code]: status.OK.response(billSummaryResponseSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await c
					.get("finance")
					.getBillSummary(c.get("user").id, c.req.valid("param").accountId),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/instalment-plans",
			tags: ["Finance"],
			summary: "List instalment plans",
			request: { headers: cookieAuthorizationSchema, query: instalmentPlansQuerySchema },
			responses: {
				[status.OK.code]: status.OK.response(instalmentPlansResponseSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await c.get("finance").listInstalmentPlans(c.get("user").id, c.req.valid("query")),
				200,
			),
	)
	.openapi(
		createRoute({
			method: "get",
			path: "/finance/investments",
			tags: ["Finance"],
			summary: "List investments",
			request: { headers: cookieAuthorizationSchema, query: investmentsQuerySchema },
			responses: {
				[status.OK.code]: status.OK.response(investmentsResponseSchema),
				...errors(),
			},
		}),
		async (c) =>
			c.json(
				await c.get("finance").getInvestments(c.get("user").id, c.req.valid("query")),
				200,
			),
	);

export default financeRouter;
