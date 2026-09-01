import type {
	Conversation,
	ConversationCreateInput,
	ConversationFeature,
	ConversationFile,
	ConversationsQuery,
} from "@server/features/conversations/schemas";

import { MAX_FILE_BYTES, SUPPORTED_FILE_EXTENSIONS } from "@open-cash/files/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { serverClient } from "@/lib/serverClient";

/** The server decides which formats exist; the picker only mirrors that list. */
export const FILE_ACCEPT = SUPPORTED_FILE_EXTENSIONS.join(",");

const MAX_FILES_PER_MESSAGE = 5;
const supportedExtensions = new Set<string>(SUPPORTED_FILE_EXTENSIONS);
const contextPattern = /\n*<finance-files>\n(?<files>[\s\S]*?)\n<\/finance-files>\s*$/u;

async function responseError(response: Response, fallback: string) {
	const problem: unknown = await response.json().catch(() => null);
	if (typeof problem === "object" && problem !== null) {
		if ("detail" in problem && typeof problem.detail === "string") {
			return new Error(problem.detail);
		}
		if ("message" in problem && typeof problem.message === "string") {
			return new Error(problem.message);
		}
	}
	return new Error(fallback);
}

// ── File rules ──────────────────────────────────────────────────────────────────

function fileExtension(name: string) {
	const dot = name.lastIndexOf(".");
	return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Mirrors the server's own rules so a doomed upload fails in the picker instead of
 * after the bytes travelled. The server still enforces all of it.
 */
export function validateFiles(files: readonly File[]): void {
	if (files.length > MAX_FILES_PER_MESSAGE) {
		throw new Error(`Anexe no máximo ${MAX_FILES_PER_MESSAGE} arquivos por mensagem.`);
	}
	for (const file of files) {
		if (!supportedExtensions.has(fileExtension(file.name))) {
			throw new Error(`O formato de “${file.name}” não é compatível.`);
		}
		if (file.size === 0) throw new Error(`“${file.name}” está vazio.`);
		if (file.size > MAX_FILE_BYTES) {
			throw new Error(
				`“${file.name}” excede o limite de ${MAX_FILE_BYTES / 1024 / 1024} MiB.`,
			);
		}
	}
}

export function mergeFiles(current: readonly File[], incoming: readonly File[]): File[] {
	const merged = new Map(
		current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]),
	);
	for (const file of incoming) {
		merged.set(`${file.name}:${file.size}:${file.lastModified}`, file);
	}
	const result = [...merged.values()];
	validateFiles(result);
	return result;
}

export function formatFileSize(size: number): string {
	if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
	return `${(size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

// ── Conversations ───────────────────────────────────────────────────────────────

export function useConversations(feature: ConversationFeature) {
	return useQuery({
		queryKey: ["conversations", "list", feature],
		queryFn: async (): Promise<Conversation[]> => {
			const query: ConversationsQuery = {
				feature,
				ordering: "-created_at",
				page_size: 50,
			};
			const response = await serverClient.v1.conversations.$get({
				header: {},
				query,
			});
			if (!response.ok) {
				throw await responseError(response, "Falha ao carregar as conversas.");
			}
			return await response.json();
		},
	});
}

export function useConversation(conversationId: string) {
	return useQuery({
		queryKey: ["conversations", "detail", conversationId],
		queryFn: async (): Promise<Conversation> => {
			const response = await serverClient.v1.conversations[":conversationId"].$get({
				header: {},
				param: { conversationId },
			});
			if (!response.ok) throw await responseError(response, "Falha ao carregar a conversa.");
			return await response.json();
		},
	});
}

export function useCreateConversation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: ConversationCreateInput): Promise<Conversation> => {
			const response = await serverClient.v1.conversations.$post({ header: {}, json: input });
			if (!response.ok) throw await responseError(response, "Falha ao criar a conversa.");
			return await response.json();
		},
		onSuccess: async (conversation) => {
			queryClient.setQueryData(["conversations", "detail", conversation.id], conversation);
			await queryClient.invalidateQueries({ queryKey: ["conversations"] });
		},
	});
}

// ── Conversation files ──────────────────────────────────────────────────────────

/**
 * Everything stored for one conversation: what the user attached and what the agent
 * published. Idle without a conversation, so the sidebar can mount outside a session.
 */
export function useConversationFiles(conversationId: string | undefined) {
	return useQuery({
		enabled: conversationId !== undefined,
		queryKey: ["conversations", "files", conversationId ?? "none"],
		queryFn: async () => {
			const response = await serverClient.v1.conversations[":conversationId"].files.$get({
				header: {},
				param: { conversationId: conversationId ?? "" },
				query: {},
			});
			if (!response.ok) throw await responseError(response, "Falha ao carregar os arquivos.");
			return await response.json();
		},
	});
}

export function useDeleteConversationFile(conversationId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (fileId: string): Promise<void> => {
			const response = await serverClient.v1.conversations[":conversationId"].files[
				":fileId"
			].$delete({
				header: {},
				param: { conversationId, fileId },
			});
			if (!response.ok) throw await responseError(response, "Falha ao apagar o arquivo.");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["conversations", "files", conversationId],
			});
		},
	});
}

/**
 * One PUT per file, each under a fresh client-minted id. Returns what the server
 * stored, which is what goes into the message context.
 */
export function useUploadConversationFiles() {
	const queryClient = useQueryClient();

	return useCallback(
		async (conversationId: string, files: readonly File[]) => {
			validateFiles(files);
			const uploaded = await Promise.all(
				files.map(async (file): Promise<ConversationFile> => {
					const response = await serverClient.v1.conversations[":conversationId"].files[
						":fileId"
					].$put(
						{
							header: {
								"content-type": file.type || "application/octet-stream",
								// A header cannot carry a raw `ç`, and the server decodes it.
								"x-file-name": encodeURIComponent(file.name),
							},
							param: { conversationId, fileId: crypto.randomUUID() },
						},
						{ init: { body: file } },
					);
					if (!response.ok) {
						throw await responseError(response, `Falha ao enviar “${file.name}”.`);
					}
					return await response.json();
				}),
			);
			if (uploaded.length > 0) {
				await queryClient.invalidateQueries({
					queryKey: ["conversations", "files", conversationId],
				});
			}
			return uploaded;
		},
		[queryClient],
	);
}

/**
 * The one place the app builds a file URL. `$url()` derives it from the same route
 * definition the requests use, so a path change cannot leave a dead link behind.
 */
export function conversationFileUrl(conversationId: string, fileId: string): string {
	return serverClient.v1.conversations[":conversationId"].files[":fileId"]
		.$url({ param: { conversationId, fileId } })
		.toString();
}

// ── Message context ─────────────────────────────────────────────────────────────

/**
 * A checklist over the server's own type instead of a hand-written shape: adding a
 * field to `ConversationFile` breaks this line until the guard checks it too.
 */
const fileChecks = {
	downloadPath: (value) => typeof value === "string",
	fileId: (value) => typeof value === "string",
	filename: (value) => typeof value === "string",
	kind: (value) => value === "upload",
	mimeType: (value) => typeof value === "string",
	sha256: (value) => typeof value === "string",
	size: (value) => typeof value === "number",
	uploadedAt: (value) => typeof value === "string",
} satisfies Record<keyof ConversationFile, (value: unknown) => boolean>;

function isConversationFile(value: unknown): value is ConversationFile {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return Object.entries(fileChecks).every(
		([key, check]) => key in candidate && check(candidate[key]),
	);
}

/**
 * Uploads ride along in the user's message so the agent can open them by id. The
 * block is stripped before the message is displayed.
 */
export function appendFileContext(message: string, files: readonly ConversationFile[]): string {
	if (files.length === 0) return message;
	return `${message.trim()}\n\n<finance-files>\n${JSON.stringify(files)}\n</finance-files>`;
}

export function parseFileContext(message: string): ConversationFile[] {
	const match = message.match(contextPattern);
	const files = match?.groups?.files;
	if (!files) return [];
	try {
		const value: unknown = JSON.parse(files);
		return Array.isArray(value) ? value.filter(isConversationFile) : [];
	} catch {
		return [];
	}
}

export function stripFileContext(message: string): string {
	return message.replace(contextPattern, "").trimEnd();
}
