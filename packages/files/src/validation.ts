import type { ConversationFileKind } from "./types";

import { fileInvalid, fileTooLarge } from "./errors";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
/**
 * The whitelist is the boundary, not a convenience: only formats the container's
 * Python tooling can actually open are storable, and the extension decides the
 * MIME type rather than whatever the client declared.
 */
const MIME_TYPES: Readonly<Record<string, string>> = {
	".csv": "text/csv",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".json": "application/json",
	".md": "text/markdown",
	".pdf": "application/pdf",
	".txt": "text/plain",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const SUPPORTED_FILE_EXTENSIONS = Object.freeze(Object.keys(MIME_TYPES));

/** Ids reach R2 keys, so they are constrained to what cannot traverse a prefix. */
export function requireSafeId(value: string, field: string): string {
	if (!SAFE_ID.test(value)) throw fileInvalid(`Invalid ${field}.`);
	return value;
}

export function sanitizeFilename(value: string): string {
	const name = value
		.normalize("NFKC")
		.replaceAll("\\", "/")
		.split("/")
		.at(-1)
		?.replaceAll(/[^a-zA-Z0-9._-]/gu, "-")
		.replaceAll(/-{2,}/gu, "-")
		.replace(/^\.+/u, "")
		.slice(0, 180);
	if (!name || name === "." || name === "..") throw fileInvalid("Invalid filename.");
	return name;
}

/**
 * A filename that travelled in a header, so it is percent-encoded: browsers cannot
 * put a raw `ç` in one.
 */
export function decodeFilename(value: string): string {
	let decoded: string;
	try {
		decoded = decodeURIComponent(value);
	} catch {
		throw fileInvalid("The file name is not valid percent-encoded text.");
	}
	return sanitizeFilename(decoded);
}

export function fileMimeType(filename: string, explicit?: string): string {
	const dot = filename.lastIndexOf(".");
	const extension = dot === -1 ? "" : filename.slice(dot).toLowerCase();
	const expected = MIME_TYPES[extension];
	if (!expected) {
		throw fileInvalid(
			`Unsupported file type. Supported extensions: ${SUPPORTED_FILE_EXTENSIONS.join(", ")}.`,
		);
	}
	// The declared type is honoured only when it agrees with the extension, so it
	// can carry parameters like `charset` without being able to lie about the type.
	const declared = explicit?.split(";", 1)[0]?.trim().toLowerCase();
	if (declared === expected && explicit) return explicit;
	return expected;
}

export function assertFileSize(size: number): number {
	if (!Number.isSafeInteger(size) || size < 1) throw fileInvalid("The file is empty.");
	if (size > MAX_FILE_BYTES) {
		throw fileTooLarge(`The file exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MiB limit.`);
	}
	return size;
}

export function requireFileKind(value: string): ConversationFileKind {
	if (value !== "upload" && value !== "output") {
		throw fileInvalid("The kind must be upload or output.");
	}
	return value;
}

export function requireListLimit(value?: number): number {
	if (value === undefined) return DEFAULT_LIST_LIMIT;
	if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIST_LIMIT) {
		throw fileInvalid(`The limit must be an integer between 1 and ${MAX_LIST_LIMIT}.`);
	}
	return value;
}

export function requireSha256(value: string): string {
	if (!SHA256.test(value)) throw fileInvalid("Invalid SHA-256 metadata.");
	return value;
}

export function toBytes(value: ArrayBuffer | Uint8Array): Uint8Array {
	return value instanceof Uint8Array ? value : new Uint8Array(value);
}

export async function sha256Hex(value: ArrayBuffer | Uint8Array): Promise<string> {
	const source = toBytes(value);
	// Copied into a fresh buffer on purpose: `digest` needs a plain ArrayBuffer, and
	// a view can be offset into a larger (or shared) one.
	const digestInput = new Uint8Array(source.byteLength);
	digestInput.set(source);
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput.buffer));
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
