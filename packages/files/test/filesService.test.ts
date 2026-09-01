import { describe, expect, test } from "bun:test";

import {
	conversationFileKey,
	fileMimeType,
	FilesService,
	isFileError,
	normalizeSandboxSourcePath,
	sanitizeFilename,
} from "../src/index";

interface StoredObject {
	bytes: Uint8Array;
	customMetadata: Record<string, string>;
	httpMetadata: { contentType?: string };
	uploaded: Date;
}

const describeObject = (key: string, stored: StoredObject) => ({
	customMetadata: stored.customMetadata,
	httpMetadata: stored.httpMetadata,
	key,
	size: stored.bytes.byteLength,
	uploaded: stored.uploaded,
});

/**
 * Enough of R2 to exercise the service: the real binding is only reachable from a
 * Worker, and every rule worth testing here is ours, not Cloudflare's.
 */
function createBucket() {
	const objects = new Map<string, StoredObject>();
	const bucket = {
		async delete(key: string) {
			objects.delete(key);
		},
		async get(key: string) {
			const stored = objects.get(key);
			if (!stored) return null;
			return {
				...describeObject(key, stored),
				arrayBuffer: async () => Uint8Array.from(stored.bytes).buffer,
				body: new Response(stored.bytes).body,
				httpEtag: '"etag"',
			};
		},
		async head(key: string) {
			const stored = objects.get(key);
			return stored ? describeObject(key, stored) : null;
		},
		async list(options: { prefix?: string } = {}) {
			const matching = [...objects.entries()]
				.filter(([key]) => key.startsWith(options.prefix ?? ""))
				.map(([key, stored]) => describeObject(key, stored));
			return { cursor: undefined, objects: matching, truncated: false };
		},
		async put(
			key: string,
			value: Uint8Array,
			options: {
				customMetadata?: Record<string, string>;
				httpMetadata?: { contentType?: string };
			},
		) {
			objects.set(key, {
				bytes: new Uint8Array(value),
				customMetadata: options.customMetadata ?? {},
				httpMetadata: options.httpMetadata ?? {},
				uploaded: new Date("2026-08-09T20:30:00.000Z"),
			});
		},
	};
	return { bucket: bucket as unknown as R2Bucket, objects };
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("conversation file boundaries", () => {
	test("keeps one opaque file id beneath the conversation's files prefix", () => {
		expect(conversationFileKey("conversation-1", "file-1")).toBe(
			"conversations/conversation-1/files/file-1",
		);
		expect(() => conversationFileKey("../other", "file-1")).toThrow("Invalid conversation id");
	});

	test("sanitizes filenames and rejects sources outside the container workspace", () => {
		expect(sanitizeFilename("../../Meu relatório.xlsx")).toBe("Meu-relat-rio.xlsx");
		expect(() => normalizeSandboxSourcePath("/etc/passwd")).toThrow(
			"Only files inside /workspace",
		);
		expect(normalizeSandboxSourcePath("results/../results/final.docx")).toBe(
			"/workspace/results/final.docx",
		);
	});

	test("allows only document formats supported by the container", () => {
		expect(fileMimeType("planilha.xlsx")).toContain("spreadsheetml");
		expect(fileMimeType("contrato.docx")).toContain("wordprocessingml");
		expect(fileMimeType("relatorio.pdf", "text/html")).toBe("application/pdf");
		expect(() => fileMimeType("macro.xlsm")).toThrow("Unsupported file type");
	});
});

describe("FilesService", () => {
	test("uploads, lists and downloads one binary file by file id", async () => {
		const { bucket, objects } = createBucket();
		const files = new FilesService(bucket);
		const bytes = new Uint8Array([80, 75, 3, 4]);

		const uploaded = await files.upload("conversation-1", "file-1", {
			bytes,
			contentType: XLSX,
			filename: "book.xlsx",
		});

		expect(uploaded.kind).toBe("upload");
		expect(uploaded.mimeType).toBe(XLSX);
		expect(uploaded.size).toBe(4);
		expect(uploaded.downloadPath).toBe("/v1/conversations/conversation-1/files/file-1");
		expect([...objects.keys()]).toEqual(["conversations/conversation-1/files/file-1"]);

		const page = await files.list("conversation-1");
		expect(page.items.map((file) => file.filename)).toEqual(["book.xlsx"]);
		expect(page.nextCursor).toBeNull();

		const { object } = await files.download("conversation-1", "file-1");
		expect(new Uint8Array(await object.arrayBuffer())).toEqual(bytes);
	});

	test("filters a listing by kind and never leaks another conversation", async () => {
		const { bucket } = createBucket();
		const files = new FilesService(bucket);
		await files.upload("conversation-1", "file-1", {
			bytes: new Uint8Array([1]),
			filename: "entrada.csv",
		});
		await files.publish("conversation-1", {
			bytes: new TextEncoder().encode("a,b"),
			filename: "saida.csv",
		});
		await files.upload("conversation-2", "file-2", {
			bytes: new Uint8Array([2]),
			filename: "outra.csv",
		});

		const outputs = await files.list("conversation-1", { kind: "output" });
		expect(outputs.items.map((file) => file.filename)).toEqual(["saida.csv"]);
		const all = await files.list("conversation-1");
		expect(all.items).toHaveLength(2);
		const other = await files.list("conversation-2");
		expect(other.items.map((file) => file.filename)).toEqual(["outra.csv"]);
	});

	test("derives the published file id from the bytes, so republishing is idempotent", async () => {
		const { bucket, objects } = createBucket();
		const files = new FilesService(bucket);
		const publish = async () =>
			await files.publish("conversation-1", {
				bytes: new TextEncoder().encode("valor"),
				filename: "resumo.md",
			});

		const first = await publish();
		const second = await publish();

		expect(second.fileId).toBe(first.fileId);
		expect(first.kind).toBe("output");
		expect(objects.size).toBe(1);
	});

	test("reads a stored file back as bytes for the container", async () => {
		const { bucket } = createBucket();
		const files = new FilesService(bucket);
		await files.upload("conversation-1", "file-1", {
			bytes: new TextEncoder().encode("a,b\n1,2"),
			filename: "dados.csv",
		});

		const { bytes, file } = await files.read("conversation-1", "file-1");
		expect(new TextDecoder().decode(bytes)).toBe("a,b\n1,2");
		expect(file.filename).toBe("dados.csv");
	});

	test("deletes a file once and reports not-found afterwards", async () => {
		const { bucket, objects } = createBucket();
		const files = new FilesService(bucket);
		await files.upload("conversation-1", "file-1", {
			bytes: new Uint8Array([1]),
			filename: "nota.txt",
		});

		await files.delete("conversation-1", "file-1");
		expect(objects.size).toBe(0);

		const missing = await files
			.delete("conversation-1", "file-1")
			.then(() => null)
			.catch((error: unknown) => error);
		expect(isFileError(missing) && missing.code).toBe("file_not_found");
	});

	test("refuses an empty file and an unsupported extension", async () => {
		const { bucket } = createBucket();
		const files = new FilesService(bucket);

		expect(
			await files
				.upload("conversation-1", "file-1", {
					bytes: new Uint8Array(),
					filename: "vazio.txt",
				})
				.catch((error: unknown) => (isFileError(error) ? error.code : null)),
		).toBe("file_invalid");
		expect(
			await files
				.upload("conversation-1", "file-2", {
					bytes: new Uint8Array([1]),
					filename: "macro.xlsm",
				})
				.catch((error: unknown) => (isFileError(error) ? error.code : null)),
		).toBe("file_invalid");
	});
});
