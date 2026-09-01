import type { ConversationFile, ConversationFileMetadata } from "./types";

import { fileDownloadPath } from "./keys";
import {
	fileMimeType,
	requireFileKind,
	requireSafeId,
	requireSha256,
	sanitizeFilename,
} from "./validation";

/**
 * Every value is re-validated on the way into the bucket, so a stored object can
 * never carry a filename or MIME type that the read path would reject.
 */
export function toCustomMetadata(metadata: ConversationFileMetadata): Record<string, string> {
	return {
		filename: sanitizeFilename(metadata.filename),
		kind: metadata.kind,
		mimeType: fileMimeType(metadata.filename, metadata.mimeType),
		sha256: requireSha256(metadata.sha256),
	};
}

/** And re-validated on the way out: the bucket is storage, not a trust boundary. */
export function readFileMetadata(
	object: Pick<R2Object, "customMetadata" | "httpMetadata">,
): ConversationFileMetadata {
	const filename = sanitizeFilename(object.customMetadata?.filename ?? "");
	const kind = requireFileKind(object.customMetadata?.kind ?? "");
	const mimeType = fileMimeType(
		filename,
		object.customMetadata?.mimeType ?? object.httpMetadata?.contentType,
	);
	return {
		filename,
		kind,
		mimeType,
		sha256: requireSha256(object.customMetadata?.sha256 ?? ""),
	};
}

export function toConversationFile(
	conversationId: string,
	fileId: string,
	object: Pick<R2Object, "customMetadata" | "httpMetadata" | "size" | "uploaded">,
): ConversationFile {
	return {
		...readFileMetadata(object),
		downloadPath: fileDownloadPath(conversationId, fileId),
		fileId: requireSafeId(fileId, "file id"),
		size: object.size,
		uploadedAt: object.uploaded.toISOString(),
	};
}
