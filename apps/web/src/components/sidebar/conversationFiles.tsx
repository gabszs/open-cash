import { Download, FileText, Trash2 } from "lucide-react";

import { iconButtonClass } from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import {
	conversationFileUrl,
	formatFileSize,
	useConversationFiles,
	useDeleteConversationFile,
} from "@/hooks/useConversations";

const placeholderClass = "px-2 py-1 text-[13px] leading-5 text-muted-foreground";
/**
 * The `px-1` matters: it is what the conversation list wraps its own rows and
 * placeholder in, so both sections indent their text to the same 24px.
 */
const listClass =
	"flex max-h-45 flex-col gap-0.5 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
/** Revealed on hover, but also on keyboard focus — otherwise they are unreachable. */
const rowActionClass =
	"opacity-0 transition-opacity group-hover/file:opacity-100 focus-visible:opacity-100";

/**
 * What the conversation is carrying: files the user attached and files the agent
 * published, both stored under the same conversation prefix.
 *
 * Split from the section below so the id is a required string here — with no
 * conversation open there is nothing to list and nothing to delete.
 */
function FileList({ conversationId }: { conversationId: string }) {
	const { toast } = useToast();
	const files = useConversationFiles(conversationId);
	const remove = useDeleteConversationFile(conversationId);
	const items = files.data?.items ?? [];

	/** Null once there are rows to render; otherwise the reason there are none. */
	const placeholder = (() => {
		if (files.isPending) return "Carregando arquivos…";
		if (files.error) return files.error.message;
		if (items.length === 0) return "Nenhum arquivo ativo.";
		return null;
	})();

	if (placeholder) {
		return (
			<div className={listClass}>
				<p className={placeholderClass}>{placeholder}</p>
			</div>
		);
	}

	return (
		<>
			<div className={listClass}>
				{items.map((file) => (
					<div
						className="group/file flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-sidebar-accent focus-within:bg-sidebar-accent"
						key={file.fileId}
					>
						<FileText size={13} className="shrink-0 text-muted-foreground" />
						<span className="grid min-w-0 flex-1 gap-px">
							<span className="truncate text-[13px] text-foreground">
								{file.filename}
							</span>
							<small className="text-xs text-muted-foreground">
								{formatFileSize(file.size)}
							</small>
						</span>
						{/* Grouped so the two actions read as one cluster at the right edge
						    instead of the download drifting toward the filename. */}
						<span className="flex shrink-0 items-center">
							<button
								className={iconButtonClass({
									size: "xs",
									className: rowActionClass,
								})}
								type="button"
								disabled={remove.isPending}
								onClick={() =>
									remove.mutate(file.fileId, {
										onError: (error) => toast.error(error.message),
									})
								}
								aria-label={`Apagar ${file.filename}`}
							>
								<Trash2 size={13} />
							</button>
							<a
								className={iconButtonClass({
									size: "xs",
									className: rowActionClass,
								})}
								href={conversationFileUrl(conversationId, file.fileId)}
								download
								aria-label={`Baixar ${file.filename}`}
							>
								<Download size={13} />
							</a>
						</span>
					</div>
				))}
			</div>
			{/* The route pages by R2 cursor and this list does not follow it, so say so
			    rather than letting a truncated list read as everything. */}
			{files.data?.nextCursor ? (
				// Outside the scroller, so `px-3` reproduces the rows' own indent.
				<p className="px-3 pt-1 text-xs text-muted-foreground">
					Mostrando os primeiros {items.length}.
				</p>
			) : null}
		</>
	);
}

export function ConversationFiles({ conversationId }: { conversationId: string | undefined }) {
	return (
		<div className="mt-4 flex shrink-0 flex-col px-3">
			<span className="flex h-7 items-center text-xs font-medium text-muted-foreground select-none">
				Arquivos
			</span>
			{conversationId === undefined ? (
				<div className={listClass}>
					<p className={placeholderClass}>Nenhum arquivo ativo.</p>
				</div>
			) : (
				<FileList conversationId={conversationId} />
			)}
		</div>
	);
}
