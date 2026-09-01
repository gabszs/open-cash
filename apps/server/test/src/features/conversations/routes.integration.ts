import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "../../../helpers/auth";

import { getDb } from "../../../../src/db";
import { ConnectionsRepository } from "../../../../src/features/connections/repository";
import { seal } from "../../../../src/lib/secrets";
import { createAuthenticatedUser } from "../../../helpers/auth";
import { jsonRequestHeaders, requestApp, responseError } from "../../../helpers/http";

const CONVERSATIONS = "/v1/conversations";
const UNKNOWN_ID = "019318f2-7c41-7a3b-8f2e-1abdcf496130";

interface ConversationResponse {
	connectionId: string | null;
	createdAt: string;
	feature: string;
	id: string;
	title: string;
	updatedAt: string;
	userId: string;
}

interface ConversationFileResponse {
	downloadPath: string;
	fileId: string;
	filename: string;
	kind: string;
	mimeType: string;
	sha256: string;
	size: number;
	uploadedAt: string;
}

const createConnection = async (userId: string, name: string) =>
	await new ConnectionsRepository(getDb(env)).create({
		userId,
		name,
		clientId: `${name}-client`,
		sealedClientSecret: await seal(`${name}-secret`, env.FINANCE_ENCRYPTION_KEY),
		itemIds: [`${name}-item`],
	});

const createConversation = async (
	cookie: string,
	title: string,
	connectionId: string,
	feature = "finance",
) => {
	const response = await requestApp(CONVERSATIONS, {
		body: JSON.stringify({ connectionId, feature, title }),
		headers: jsonRequestHeaders(cookie),
		method: "POST",
	});
	if (!response.ok) {
		throw await responseError(response);
	}
	return await response.json<ConversationResponse>();
};

const listConversations = async (cookie: string, query = "") => {
	const response = await requestApp(`${CONVERSATIONS}${query}`, { headers: { Cookie: cookie } });
	if (!response.ok) {
		throw await responseError(response);
	}
	return await response.json<ConversationResponse[]>();
};

// Two users for the whole file: the auth rate limiter is keyed per client IP, and
// every createAuthenticatedUser() costs a sign-up plus a sign-in.
describe("conversation routes", () => {
	let owner: AuthenticatedUser;
	let other: AuthenticatedUser;
	let ownerConnection: string;
	let otherConnection: string;

	beforeAll(async () => {
		owner = await createAuthenticatedUser();
		other = await createAuthenticatedUser();
		const created = await Promise.all([
			createConnection(owner.userId, "owner-bank"),
			createConnection(other.userId, "other-bank"),
		]);
		[ownerConnection, otherConnection] = created.map((row) => row.id) as [string, string];
	});

	it("rejects every route without a session", async () => {
		const list = await requestApp(CONVERSATIONS);
		const create = await requestApp(CONVERSATIONS, {
			body: JSON.stringify({ connectionId: UNKNOWN_ID, feature: "finance", title: "Saldo" }),
			headers: jsonRequestHeaders(),
			method: "POST",
		});
		const detail = await requestApp(`${CONVERSATIONS}/${UNKNOWN_ID}`);
		const upload = await requestApp(
			`${CONVERSATIONS}/${UNKNOWN_ID}/files/${crypto.randomUUID()}`,
			{
				body: "file",
				headers: {
					"Content-Type": "text/plain",
					"X-File-Name": "file.txt",
				},
				method: "PUT",
			},
		);

		expect([list.status, create.status, detail.status, upload.status]).toEqual([
			401, 401, 401, 401,
		]);
		await Promise.all([list.text(), create.text(), detail.text(), upload.text()]);
	});

	it("creates a conversation with a uuidv7 id and reads it back", async () => {
		const created = await createConversation(
			owner.cookie,
			"Quanto gastei em mercado?",
			ownerConnection,
		);

		expect(created.feature).toBe("finance");
		expect(created.connectionId).toBe(ownerConnection);
		expect(created.title).toBe("Quanto gastei em mercado?");
		expect(created.userId).toBe(owner.userId);
		expect(await env.SHARED_KV.get(created.id)).toBe(owner.userId);
		// uuidv7: the version nibble is 7.
		expect(created.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
		);
		expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
		expect(new Date(created.updatedAt).toISOString()).toBe(created.updatedAt);
		expect(Object.keys(created).toSorted()).toEqual([
			"connectionId",
			"createdAt",
			"feature",
			"id",
			"title",
			"updatedAt",
			"userId",
		]);

		const detail = await requestApp(`${CONVERSATIONS}/${created.id}`, {
			headers: { Cookie: owner.cookie },
		});
		expect(detail.status).toBe(200);
		expect(await detail.json()).toEqual(created);
	});

	it("lists the caller's conversations by creation date, newest first", async () => {
		const first = await createConversation(owner.cookie, "Primeira", ownerConnection);
		const second = await createConversation(owner.cookie, "Segunda", ownerConnection);

		const rows = await listConversations(owner.cookie);
		const ids = rows.map((row) => row.id);
		const timestamps = rows.map((row) => Date.parse(row.createdAt));

		expect(ids).toContain(first.id);
		expect(ids).toContain(second.id);
		expect(timestamps).toEqual(timestamps.toSorted((left, right) => right - left));
	});

	it("honours pagination and the feature filter", async () => {
		expect(await listConversations(owner.cookie, "?page_size=1")).toHaveLength(1);
		expect(
			await listConversations(owner.cookie, "?ordering=updated_at&page_size=1"),
		).toHaveLength(1);

		const finance = await listConversations(owner.cookie, "?feature=finance");
		expect(finance.length).toBeGreaterThan(0);
		expect(finance.every((row) => row.feature === "finance")).toBe(true);

		const afterFutureDate = await listConversations(
			owner.cookie,
			`?created_after=${encodeURIComponent("2100-01-01T00:00:00.000Z")}`,
		);
		expect(afterFutureDate).toEqual([]);
	});

	it("refuses to pin a connection owned by another user", async () => {
		// The foreign key would happily accept this id: it proves the connection
		// exists, not that it is the caller's. Without the ownership check the agent
		// would read someone else's finances through this conversation.
		const response = await requestApp(CONVERSATIONS, {
			body: JSON.stringify({
				connectionId: otherConnection,
				feature: "finance",
				title: "Saldo alheio",
			}),
			headers: jsonRequestHeaders(owner.cookie),
			method: "POST",
		});

		expect(response.status).toBe(404);
		await response.text();
	});

	it("rejects a create without a connection", async () => {
		const response = await requestApp(CONVERSATIONS, {
			body: JSON.stringify({ feature: "finance", title: "Sem conexão" }),
			headers: jsonRequestHeaders(owner.cookie),
			method: "POST",
		});

		expect(response.status).toBe(422);
		await response.text();
	});

	it("hides conversations owned by another user", async () => {
		const conversation = await createConversation(
			owner.cookie,
			"Fatura do cartão",
			ownerConnection,
		);

		const detail = await requestApp(`${CONVERSATIONS}/${conversation.id}`, {
			headers: { Cookie: other.cookie },
		});
		expect(detail.status).toBe(404);
		await detail.text();

		expect(await listConversations(other.cookie)).toEqual([]);
	});

	it("refuses to proxy a conversation the caller does not own", async () => {
		const response = await requestApp(`/ai/finance/${UNKNOWN_ID}`, {
			headers: { Cookie: owner.cookie },
		});
		const upload = await requestApp(
			`${CONVERSATIONS}/${UNKNOWN_ID}/files/${crypto.randomUUID()}`,
			{
				body: "file",
				headers: {
					Cookie: owner.cookie,
					"Content-Type": "text/plain",
					"X-File-Name": "file.txt",
				},
				method: "PUT",
			},
		);

		expect(response.status).toBe(404);
		expect(upload.status).toBe(404);
		await Promise.all([response.text(), upload.text()]);
	});

	it("validates the feature, title, pagination, ordering and conversation id", async () => {
		const unknownFeature = await requestApp(CONVERSATIONS, {
			body: JSON.stringify({ feature: "analysis", title: "Análise" }),
			headers: jsonRequestHeaders(owner.cookie),
			method: "POST",
		});
		const emptyTitle = await requestApp(CONVERSATIONS, {
			body: JSON.stringify({ feature: "finance", title: "   " }),
			headers: jsonRequestHeaders(owner.cookie),
			method: "POST",
		});
		const hugePageSize = await requestApp(`${CONVERSATIONS}?page_size=1001`, {
			headers: { Cookie: owner.cookie },
		});
		const invalidOrdering = await requestApp(`${CONVERSATIONS}?ordering=title`, {
			headers: { Cookie: owner.cookie },
		});
		const invalidConversationId = await requestApp(`${CONVERSATIONS}/not-a-uuid`, {
			headers: { Cookie: owner.cookie },
		});

		expect(unknownFeature.status).toBe(422);
		expect(emptyTitle.status).toBe(422);
		expect(hugePageSize.status).toBe(422);
		expect(invalidOrdering.status).toBe(422);
		expect(invalidConversationId.status).toBe(422);
		await Promise.all([
			unknownFeature.text(),
			emptyTitle.text(),
			hugePageSize.text(),
			invalidOrdering.text(),
			invalidConversationId.text(),
		]);
	});

	// Files live in R2 under the conversation's prefix, so this walks the whole
	// lifecycle against the simulated bucket rather than trusting the service unit
	// tests: the route is where ownership, headers and error mapping meet.
	it("stores, lists, downloads and then deletes one conversation file", async () => {
		const conversation = await createConversation(owner.cookie, "Extrato", ownerConnection);
		const fileId = crypto.randomUUID();
		const contents = "data,valor\n2026-08-01,10.5";
		const path = `${CONVERSATIONS}/${conversation.id}/files/${fileId}`;

		const upload = await requestApp(path, {
			body: contents,
			headers: {
				Cookie: owner.cookie,
				"Content-Type": "text/csv",
				// Percent-encoded, like a browser has to send it.
				"X-File-Name": encodeURIComponent("relatório final.csv"),
			},
			method: "PUT",
		});
		expect(upload.status).toBe(200);
		const stored = await upload.json<ConversationFileResponse>();
		expect(stored).toMatchObject({
			downloadPath: path,
			fileId,
			filename: "relat-rio-final.csv",
			kind: "upload",
			mimeType: "text/csv",
			size: contents.length,
		});
		expect(stored.sha256).toMatch(/^[a-f0-9]{64}$/u);

		const listed = await requestApp(`${CONVERSATIONS}/${conversation.id}/files?kind=upload`, {
			headers: { Cookie: owner.cookie },
		});
		expect(listed.status).toBe(200);
		const page = await listed.json<{
			items: ConversationFileResponse[];
			nextCursor: string | null;
		}>();
		expect(page.nextCursor).toBeNull();
		expect(page.items.map((file) => file.fileId)).toEqual([fileId]);

		const download = await requestApp(path, { headers: { Cookie: owner.cookie } });
		expect(download.status).toBe(200);
		expect(download.headers.get("Content-Disposition")).toBe(
			'attachment; filename="relat-rio-final.csv"',
		);
		expect(download.headers.get("Content-Security-Policy")).toBe("sandbox");
		expect(await download.text()).toBe(contents);

		const removed = await requestApp(path, {
			headers: { Cookie: owner.cookie },
			method: "DELETE",
		});
		expect(removed.status).toBe(204);
		await removed.text();

		// The delete is not idempotent on purpose: a second one has to answer 404.
		const missing = await requestApp(path, {
			headers: { Cookie: owner.cookie },
			method: "DELETE",
		});
		expect(missing.status).toBe(404);
		await missing.text();
	});

	it("refuses an unsupported file type and hides files from another user", async () => {
		const conversation = await createConversation(owner.cookie, "Anexos", ownerConnection);
		const fileId = crypto.randomUUID();

		const unsupported = await requestApp(
			`${CONVERSATIONS}/${conversation.id}/files/${fileId}`,
			{
				body: "MZ",
				headers: {
					Cookie: owner.cookie,
					"Content-Type": "application/octet-stream",
					"X-File-Name": "macro.xlsm",
				},
				method: "PUT",
			},
		);
		expect(unsupported.status).toBe(422);
		await unsupported.text();

		const strangerList = await requestApp(`${CONVERSATIONS}/${conversation.id}/files`, {
			headers: { Cookie: other.cookie },
		});
		const strangerDelete = await requestApp(
			`${CONVERSATIONS}/${conversation.id}/files/${fileId}`,
			{ headers: { Cookie: other.cookie }, method: "DELETE" },
		);

		expect([strangerList.status, strangerDelete.status]).toEqual([404, 404]);
		await Promise.all([strangerList.text(), strangerDelete.text()]);
	});
});
