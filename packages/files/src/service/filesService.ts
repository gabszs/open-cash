import type {
	ConversationFile,
	ConversationFileKind,
	ConversationFileListOptions,
	ConversationFileListPage,
	ConversationFileMetadata,
	ConversationFilePublish,
	ConversationFileUpload,
	ConversationOutputFile,
	ConversationUploadFile,
} from "../types";

import { fileNotFound } from "../errors";
import { conversationFileKey, conversationFilesPrefix, fileDownloadPath } from "../keys";
import { toConversationFile, toCustomMetadata } from "../metadata";
import {
	assertFileSize,
	fileMimeType,
	requireFileKind,
	requireListLimit,
	requireSafeId,
	sanitizeFilename,
	sha256Hex,
	toBytes,
} from "../validation";

/**
 * Every conversation file operation over R2, in one place, so the key layout and
 * the object metadata have a single owner. The bucket arrives by constructor
 * because the two callers bind the same bucket under different names — `R2` on the
 * API, `R2` on the agent.
 *
 * Nothing here authorizes anything: a conversation id is all it takes to reach a
 * file, so the caller has to prove ownership first. The API does it on the route
 * with `ConversationsService.requireOwned`; the agent only ever holds the id of
 * the conversation it is running for.
 */
export class FilesService {
	private readonly bucket: R2Bucket;

	constructor(bucket: R2Bucket) {
		this.bucket = bucket;
	}

	/**
	 * One scan of the conversation's prefix. `kind` is filtered after the bucket
	 * applied `limit`, so `limit` bounds objects scanned rather than items returned
	 * — callers follow `nextCursor` until it is null instead of assuming a short
	 * page means the end.
	 */
	async list(
		conversationId: string,
		options: ConversationFileListOptions = {},
	): Promise<ConversationFileListPage> {
		const prefix = conversationFilesPrefix(conversationId);
		const kind = options.kind === undefined ? undefined : requireFileKind(options.kind);
		const listed = await this.bucket.list({
			cursor: options.cursor,
			include: ["customMetadata", "httpMetadata"],
			limit: requireListLimit(options.limit),
			prefix,
		});
		const items = listed.objects.flatMap((object) => {
			try {
				const file = toConversationFile(
					conversationId,
					object.key.slice(prefix.length),
					object,
				);
				return kind === undefined || file.kind === kind ? [file] : [];
			} catch {
				// One unreadable object must not take the whole page down with it.
				return [];
			}
		});
		return { items, nextCursor: listed.truncated ? listed.cursor : null };
	}

	/** Metadata without the body, which is also the existence check. */
	async metadata(conversationId: string, fileId: string): Promise<ConversationFile> {
		const object = await this.bucket.head(conversationFileKey(conversationId, fileId));
		if (!object) throw fileNotFound();
		return toConversationFile(conversationId, fileId, object);
	}

	/**
	 * The body plus its metadata. The R2 object is handed back untouched so the
	 * caller can stream it and copy the bucket's own HTTP metadata onto a response.
	 */
	async download(
		conversationId: string,
		fileId: string,
	): Promise<{ file: ConversationFile; object: R2ObjectBody }> {
		const object = await this.bucket.get(conversationFileKey(conversationId, fileId));
		if (!object) throw fileNotFound();
		return { file: toConversationFile(conversationId, fileId, object), object };
	}

	/** The whole file in memory — for restoring a working copy into the container. */
	async read(
		conversationId: string,
		fileId: string,
	): Promise<{ bytes: Uint8Array; file: ConversationFile }> {
		const { file, object } = await this.download(conversationId, fileId);
		assertFileSize(object.size);
		return { bytes: new Uint8Array(await object.arrayBuffer()), file };
	}

	/** A browser upload: the client mints the file id, so it is validated here. */
	async upload(
		conversationId: string,
		fileId: string,
		upload: ConversationFileUpload,
	): Promise<ConversationUploadFile> {
		const filename = sanitizeFilename(upload.filename);
		return await this.write(
			conversationId,
			requireSafeId(fileId, "file id"),
			"upload",
			filename,
			fileMimeType(filename, upload.contentType),
			toBytes(upload.bytes),
		);
	}

	/**
	 * An agent result. The id is derived from the bytes and the name, so publishing
	 * the same file twice overwrites one object instead of piling up duplicates.
	 */
	async publish(
		conversationId: string,
		file: ConversationFilePublish,
	): Promise<ConversationOutputFile> {
		const filename = sanitizeFilename(file.filename);
		const mimeType = fileMimeType(filename, file.mimeType);
		const bytes = toBytes(file.bytes);
		const fileId = await this.contentFileId(bytes, filename);
		return await this.write(conversationId, fileId, "output", filename, mimeType, bytes);
	}

	/** Answers not-found before deleting, since `R2Bucket.delete` cannot tell us. */
	async delete(conversationId: string, fileId: string): Promise<ConversationFile> {
		const file = await this.metadata(conversationId, fileId);
		await this.bucket.delete(conversationFileKey(conversationId, fileId));
		return file;
	}

	private async contentFileId(bytes: Uint8Array, filename: string): Promise<string> {
		const sha256 = await sha256Hex(bytes);
		return await sha256Hex(new TextEncoder().encode(`${sha256}\0${filename}`));
	}

	private async write<Kind extends ConversationFileKind>(
		conversationId: string,
		fileId: string,
		kind: Kind,
		filename: string,
		mimeType: string,
		bytes: Uint8Array,
	): Promise<ConversationFile & { kind: Kind }> {
		assertFileSize(bytes.byteLength);
		const metadata: ConversationFileMetadata & { kind: Kind } = {
			filename,
			kind,
			mimeType,
			sha256: await sha256Hex(bytes),
		};
		await this.bucket.put(conversationFileKey(conversationId, fileId), bytes, {
			customMetadata: toCustomMetadata(metadata),
			httpMetadata: { contentType: mimeType },
		});
		return {
			...metadata,
			downloadPath: fileDownloadPath(conversationId, fileId),
			fileId,
			size: bytes.byteLength,
			uploadedAt: new Date().toISOString(),
		};
	}
}
