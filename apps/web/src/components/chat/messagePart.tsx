import type { FlueConversationPart } from "@flue/react";
import type { ConversationOutputFile } from "@server/features/conversations/schemas";

import { Download, FileText } from "lucide-react";

import { Markdown } from "@/components/chat/markdown";
import { FinanceChart } from "@/components/financeChart";
import { conversationFileUrl } from "@/hooks/useConversations";
import { serverUrl } from "@/lib/const";

const cardClass =
	"flex w-fit max-w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent";

/**
 * The link is derived from the file route rather than from the `downloadPath` the
 * agent wrote into the stream: parts persisted before the route moved still carry
 * the old path, and the id is all it takes to address the file.
 */
function FileCard({
	conversationId,
	file,
}: {
	conversationId: string;
	file: ConversationOutputFile;
}) {
	const label = `${file.mimeType} · ${(file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB · baixar`;
	return (
		<a className={cardClass} href={conversationFileUrl(conversationId, file.fileId)} download>
			<Download size={16} className="shrink-0 text-muted-foreground" />
			<span className="grid gap-0.5">
				<strong className="truncate font-medium">{file.filename}</strong>
				<small className="text-xs text-muted-foreground">{label}</small>
			</span>
		</a>
	);
}

/**
 * Everything a message can carry that is not an agent step — reasoning and tool
 * calls are grouped into `ActivityPanel` before this ever sees them.
 */
export function MessagePart({
	conversationId,
	part,
}: {
	conversationId: string;
	part: FlueConversationPart;
}) {
	if (part.type === "text") {
		return (
			<div
				className={
					part.state === "streaming"
						? "after:ml-0.5 after:animate-pulse after:content-['▍']"
						: undefined
				}
			>
				<Markdown>{part.text}</Markdown>
			</div>
		);
	}

	if (part.type === "file") {
		// A parte carrega o `downloadPath` da API, que é relativo. Resolvido contra
		// a página, ele apontaria para o SPA — que não serve arquivo nenhum.
		if (!part.url) return null;
		return (
			<a className={cardClass} href={new URL(part.url, serverUrl).toString()} download>
				<FileText size={16} className="shrink-0 text-muted-foreground" />
				<span className="truncate">{part.filename ?? "Baixar arquivo"}</span>
			</a>
		);
	}

	if (part.type === "data-finance-chart") {
		return <FinanceChart chart={part.data as Parameters<typeof FinanceChart>[0]["chart"]} />;
	}

	if (part.type === "data-finance-file") {
		return (
			<FileCard conversationId={conversationId} file={part.data as ConversationOutputFile} />
		);
	}

	return null;
}
