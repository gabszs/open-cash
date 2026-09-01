import { describe, expect, test } from "bun:test";

import {
	appendFileContext,
	parseFileContext,
	stripFileContext,
} from "../src/hooks/useConversations";

describe("conversation file message context", () => {
	const upload = {
		downloadPath: "/v1/conversations/conversation-1/files/file-1",
		fileId: "file-1",
		filename: "orcamento.xlsx",
		kind: "upload" as const,
		mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		sha256: "a".repeat(64),
		size: 42,
		uploadedAt: "2026-08-09T20:30:00.000Z",
	};

	test("keeps file metadata in model context but removes it from displayed prose", () => {
		const message = appendFileContext("Atualize a projeção", [upload]);
		expect(parseFileContext(message)).toEqual([upload]);
		expect(stripFileContext(message)).toBe("Atualize a projeção");
	});

	test("leaves ordinary messages unchanged", () => {
		expect(parseFileContext("Sem anexo")).toEqual([]);
		expect(stripFileContext("Sem anexo")).toBe("Sem anexo");
	});
});
