"use agent";

import type { Sandbox as CloudflareSandbox } from "@cloudflare/sandbox";
import type { AgentProps, DurabilityConfig } from "@flue/runtime";

import { getSandbox } from "@cloudflare/sandbox";
import {
	useAgentStart,
	useDataWriter,
	useMcpConnection,
	useModel,
	usePersistentState,
	useResponseFinish,
	useResponseStart,
	useSandbox,
	useSkill,
	useTool,
} from "@flue/runtime";
import { cloudflareSandbox } from "@flue/runtime/cloudflare";
import {
	fileMimeType,
	FilesService,
	normalizeSandboxSourcePath,
	sanitizeFilename,
	uploadedFilePath,
} from "@open-cash/files";
import { env } from "cloudflare:workers";
import * as v from "valibot";

import type { UserIdentityDO } from "../durable-objects/identityDO";

import documentFiles from "../skills/document-files/SKILL.md";
import financeAnalysis from "../skills/financial-analysis/SKILL.md";

type UserIdentityStub = Pick<UserIdentityDO, "ensureAgent" | "signAgentJwt">;
interface UserIdentityNamespace {
	getByName(name: string): UserIdentityStub;
}

interface AgentAuthState {
	status: "ready";
	userId: string;
	hostId: string;
	agentId: string;
}

const isReady = (state: AgentAuthState | null): state is AgentAuthState =>
	state?.status === "ready" &&
	Boolean(state.userId) &&
	Boolean(state.hostId) &&
	Boolean(state.agentId);

const chartSchema = v.object({
	title: v.string(),
	type: v.picklist(["bar", "line", "donut", "area"]),
	description: v.optional(v.string()),
	series: v.array(
		v.object({
			name: v.string(),
			color: v.optional(v.string()),
			data: v.array(v.object({ label: v.string(), value: v.number() })),
		}),
	),
});

const textFileSchema = v.object({
	filename: v.string(),
	content: v.string(),
	mimeType: v.picklist(["text/csv", "application/json", "text/markdown"]),
});

const financeTools = [
	"getAccounts",
	"getBalanceByAccount",
	"getBalance",
	"getTransactions",
	"listTransactions",
	"getTransactionDetails",
	"getInvestments",
	"getBills",
	"getBillSummary",
	"listInstalmentPlans",
	"listSources",
] as const;

// The same bucket the API reads from, bound here under a different name. The
// service is the single owner of the key layout and of the object metadata, so
// what these tools write is exactly what `GET /v1/conversations/:id/files` lists.
const files = new FilesService(env.R2);

async function loadAgentState(id: string): Promise<AgentAuthState> {
	const userId = await env.SHARED_KV.get(id);
	if (!userId) throw new Error("Conversation identity not found");
	const identity = (env.USER_IDENTITY as unknown as UserIdentityNamespace).getByName(userId);
	const agent = await identity.ensureAgent(id, financeTools);
	if (!agent.agentId) throw new Error("Agent identity was not registered");
	return {
		agentId: agent.agentId,
		hostId: agent.hostId,
		status: "ready" as const,
		userId,
	};
}

export function FinanceAgent({ id }: AgentProps) {
	const [analyses, setAnalyses] = usePersistentState("analysis-count", 0);
	const [authState, setAuthState] = usePersistentState<AgentAuthState | null>("agent-auth", null);
	const getAgentState = async (): Promise<AgentAuthState> => {
		if (isReady(authState)) return authState;
		return loadAgentState(id);
	};
	const writeChart = useDataWriter("finance-chart", { schema: chartSchema });
	const writeFile = useDataWriter("finance-file", {
		schema: v.object({
			downloadPath: v.string(),
			fileId: v.string(),
			filename: v.string(),
			kind: v.literal("output"),
			mimeType: v.string(),
			sha256: v.string(),
			size: v.number(),
			uploadedAt: v.string(),
		}),
	});
	useModel("cloudflare/dynamic/low-budget");
	useSkill(financeAnalysis);
	useSkill(documentFiles);
	const { Sandbox } = env as unknown as {
		Sandbox: DurableObjectNamespace<CloudflareSandbox>;
	};
	// One real Linux container per conversation. Container files are working
	// copies; uploads and published files live durably in the conversation's
	// isolated R2 prefix and can be restored after the container sleeps.
	useSandbox(
		cloudflareSandbox(
			getSandbox(Sandbox, id, { normalizeId: true, sleepAfter: "10m", transport: "rpc" }),
		),
	);
	useMcpConnection({
		name: "finance",
		url: env.FINANCE_MCP_URL,
		auth: async () => {
			const state = await getAgentState();
			const identity = (env.USER_IDENTITY as unknown as UserIdentityNamespace).getByName(
				state.userId,
			);
			return await identity.signAgentJwt(state.agentId, new URL(env.FINANCE_MCP_URL).origin);
		},
		// tools: [...financeTools],
	});

	useTool({
		name: "render_finance_chart",
		description:
			"Render a structured financial chart in the user's chat. Use after retrieving real data.",
		input: chartSchema,
		run({ data: chart }) {
			writeChart(chart);
			setAnalyses((count) => count + 1);
			return "The chart is now visible to the user.";
		},
	});

	useTool({
		name: "open_file",
		description:
			"Restore one conversation file from durable storage into the Linux container so shell and Python tools can inspect or edit it.",
		input: v.object({ fileId: v.string() }),
		harness: true,
		durable: true,
		async run({ data, harness, step }) {
			const opened = await step.do(`open:${data.fileId}`, async () => {
				const { bytes, file } = await files.read(id, data.fileId);
				const path = uploadedFilePath(file.fileId, file.filename);
				await harness.sandbox.writeFile(path, bytes);
				return { ...file, path };
			});
			return { output: opened };
		},
	});

	useTool({
		name: "publish_file",
		description:
			"Publish a completed file from the Linux container as a durable downloadable conversation file. Use this for XLSX, DOCX, PDF, CSV, JSON, Markdown, or text results.",
		input: v.object({
			path: v.string(),
			filename: v.optional(v.string()),
			mimeType: v.optional(v.string()),
		}),
		harness: true,
		durable: true,
		async run({ data, harness, step }) {
			const path = normalizeSandboxSourcePath(data.path);
			const sourceName = path.split("/").at(-1) ?? "result";
			const filename = sanitizeFilename(data.filename ?? sourceName);
			const mimeType = fileMimeType(filename, data.mimeType);
			const file = await step.do(`publish:${path}:${filename}`, async () => {
				const stat = await harness.sandbox.stat(path);
				if (!stat.isFile) throw new Error("Only regular files can be published.");
				const bytes = await harness.sandbox.readFileBuffer(path);
				return await files.publish(id, { bytes, filename, mimeType });
			});
			writeFile(file);
			return { output: file };
		},
	});

	useTool({
		name: "create_finance_file",
		description: "Create and publish a downloadable CSV, JSON, or Markdown finance file.",
		input: textFileSchema,
		harness: true,
		durable: true,
		async run({ data: requestedFile, harness, step }) {
			const safeName = sanitizeFilename(requestedFile.filename);
			const mimeType = fileMimeType(safeName, requestedFile.mimeType);
			const path = `/workspace/${safeName}`;
			const file = await step.do(`create:${safeName}`, async () => {
				const bytes = new TextEncoder().encode(requestedFile.content);
				await harness.sandbox.writeFile(path, bytes);
				return await files.publish(id, { bytes, filename: safeName, mimeType });
			});
			writeFile(file);
			return { output: file };
		},
	});

	useAgentStart(async ({ append }) => {
		const state = await getAgentState();
		setAuthState(state);
		append({
			kind: "signal",
			type: "finance.context",
			body: `Authenticated finance files are ready. Completed analyses in this conversation: ${analyses}.`,
		});
	});
	useResponseStart(() => ({ product: "finance", startedAt: Date.now() }));
	useResponseFinish(({ metadata, response }) => ({
		elapsedMs: Date.now() - Number(metadata.startedAt ?? Date.now()),
		toolCalls: response.toolCalls.length,
		totalTokens: response.usage.totalTokens,
	}));

	return `You are the user's private Open Finance analyst and document assistant. Only use financial data returned by the authenticated finance MCP. Never invent balances, transactions, institutions, or projections. Explain money in Brazilian Portuguese, distinguish facts from estimates, and state the date range used. Use render_finance_chart for comparisons or trends. Use create_finance_file for small text exports and the document-files workflow for attached or binary files: open files, inspect and edit them with the Linux/Python tools, validate the result, then publish it. Finance data is read-only and comes directly from Pluggy. Every finance MCP call is already scoped to the single user who owns this conversation and to the one bank connection pinned to it, so figures cover that connection alone — say so rather than implying they cover every account the user has.`;
}

// `satisfies` on purpose: expando properties on a function are inferred, not
// checked, so a typo here (`timeout: "15m"` was one) only surfaced at runtime as
// a failed submission — the statics are validated when the agent renders.
FinanceAgent.durability = { maxAttempts: 3, timeoutMs: 900_000 } satisfies DurabilityConfig;
