import { fileInvalid } from "./errors";
import { requireSafeId, sanitizeFilename } from "./validation";

/**
 * One prefix per conversation, so a list can never reach across conversations and
 * an id that is not a safe id can never widen the prefix it is pasted into.
 */
export function conversationFilesPrefix(conversationId: string): string {
	return `conversations/${requireSafeId(conversationId, "conversation id")}/files/`;
}

export function conversationFileKey(conversationId: string, fileId: string): string {
	return `${conversationFilesPrefix(conversationId)}${requireSafeId(fileId, "file id")}`;
}

/** Where the file is downloadable from — an API route, not an agent one. */
export function fileDownloadPath(conversationId: string, fileId: string): string {
	return `/v1/conversations/${encodeURIComponent(requireSafeId(conversationId, "conversation id"))}/files/${encodeURIComponent(requireSafeId(fileId, "file id"))}`;
}

/** Where `open_file` hydrates a working copy inside the container. */
export function uploadedFilePath(fileId: string, filename: string): string {
	return `/workspace/uploads/${requireSafeId(fileId, "file id")}/${sanitizeFilename(filename)}`;
}

/**
 * Resolves a path the model asked to publish. Traversal is resolved rather than
 * rejected, then the result has to still be inside the workspace — so `..` cannot
 * walk out into the container's own filesystem.
 */
export function normalizeSandboxSourcePath(value: string): string {
	const absolute = value.startsWith("/") ? value : `/workspace/${value}`;
	const parts: string[] = [];
	for (const part of absolute.split("/")) {
		if (!part || part === ".") continue;
		if (part === "..") parts.pop();
		else parts.push(part);
	}
	const normalized = `/${parts.join("/")}`;
	if (normalized !== "/workspace" && !normalized.startsWith("/workspace/")) {
		throw fileInvalid("Only files inside /workspace can be published.");
	}
	return normalized;
}
