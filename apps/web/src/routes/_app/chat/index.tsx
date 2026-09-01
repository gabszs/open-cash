import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { useState } from "react";

import { useAppSidebar } from "@/components/appSidebarContext";
import { useAuth } from "@/components/authProvider";
import { Composer } from "@/components/chat/composer";
import { FilePicker } from "@/components/chat/filePicker";
import { useConnection } from "@/components/connectionProvider";
import { RouteError } from "@/components/routeError";
import { RoutePending } from "@/components/routePending";
import { SidebarTrigger } from "@/components/sidebar/sidebarTrigger";
import { LogoMark } from "@/components/ui/logoMark";
import { buttonClass, pageClass } from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import {
	appendFileContext,
	useCreateConversation,
	useUploadConversationFiles,
} from "@/hooks/useConversations";
import { createFinanceAgentClient } from "@/lib/agentClient";

export const Route = createFileRoute("/_app/chat/")({
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: ChatHome,
	pendingComponent: RoutePending,
	errorComponent: RouteError,
});

const suggestions = [
	"Onde meu dinheiro foi gasto este mês?",
	"Compare meus gastos com alimentação e transporte",
	"Quanto da fatura já está comprometido com parcelas?",
	"Crie um relatório CSV das últimas transações",
];

function ChatHome() {
	const { session } = useAuth();
	const { connectionId } = useConnection();
	const { open } = useAppSidebar();
	const navigate = useNavigate();
	const { toast } = useToast();
	const createConversation = useCreateConversation();
	const uploadFiles = useUploadConversationFiles();
	const [message, setMessage] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [starting, setStarting] = useState(false);

	/**
	 * The conversation row has to exist before the first Flue send: the AI proxy
	 * gates `/ai/*` on it and answers 404 otherwise. So the id comes from the
	 * server, then the first message opens the stream, and only then do we navigate.
	 *
	 * Sending here rather than on the chat route is what keeps the agent's event
	 * stream from being read before it exists — a stream is created by the first
	 * prompt, so a chat route that mounted first would read a 404 `stream_not_found`
	 * every time a conversation was opened.
	 */
	async function startChat(text = message) {
		const value = text.trim();
		if (!value || !session?.user.id || starting) return;
		// The connection is pinned on the conversation for good, so there is nothing
		// sensible to create without one.
		if (connectionId === null) {
			toast.error("Escolha uma conexão no menu do perfil antes de iniciar uma conversa.");
			return;
		}
		setStarting(true);
		try {
			const conversation = await createConversation.mutateAsync({
				connectionId,
				feature: "finance",
				title: value.length > 54 ? `${value.slice(0, 51)}…` : value,
			});
			const uploads = await uploadFiles(conversation.id, files);
			const body = appendFileContext(value, uploads);
			try {
				await createFinanceAgentClient(conversation.id).send({
					message: { kind: "user", body },
				});
			} catch {
				// The conversation exists, so losing the send is recoverable: hand the text
				// to the chat route, which retries it as soon as the stream is readable.
				sessionStorage.setItem(`pending-chat:${conversation.id}`, body);
			}
			setFiles([]);
			await navigate({ to: "/chat/$sessionId", params: { sessionId: conversation.id } });
		} catch (error) {
			setStarting(false);
			toast.error(
				error instanceof Error ? error.message : "Não foi possível iniciar a conversa.",
			);
		}
	}

	return (
		<main className={pageClass}>
			<div className="flex h-13 shrink-0 items-center gap-3 px-3">
				{open ? null : <SidebarTrigger side="bottom" />}
			</div>
			<div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pt-6 pb-20">
				<section className="w-[min(100%,720px)]">
					<h1 className="mb-7 flex items-center justify-center gap-2.5 font-mono text-[clamp(20px,3vw,30px)] font-medium tracking-[-0.01em] [&_span]:text-muted-foreground">
						<LogoMark size={26} />
						Converse com <span>suas finanças</span>
					</h1>
					<Composer
						variant="stacked"
						value={message}
						onChange={setMessage}
						onSubmit={() => void startChat()}
						// Nothing to abort yet: the conversation is still being created.
						state={starting ? "working" : "idle"}
						placeholder="Pergunte sobre contas, cartões, gastos, investimentos..."
						ariaLabel="Pergunta para o assistente"
						autoFocus
						leading={
							<>
								<FilePicker
									files={files}
									onChange={setFiles}
									onError={(error) => toast.error(error)}
									disabled={starting}
								/>
								<button
									className={buttonClass({ variant: "ghost", size: "sm" })}
									type="button"
								>
									<Landmark size={14} /> Open Finance
								</button>
							</>
						}
					/>
					<div className="mt-3 grid grid-cols-2 gap-2 max-mobile:grid-cols-1">
						{suggestions.map((suggestion) => (
							<button
								className="min-h-10 cursor-pointer rounded-lg border border-border bg-transparent px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
								type="button"
								key={suggestion}
								disabled={starting}
								onClick={() => void startChat(suggestion)}
							>
								{suggestion}
							</button>
						))}
					</div>
				</section>
			</div>
		</main>
	);
}
