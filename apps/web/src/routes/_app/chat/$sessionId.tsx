import type { FlueConversationMessage, FlueConversationPart } from "@flue/react";

import { useFlueAgent } from "@flue/react";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import type { ActivityPart } from "@/components/chat/activityPanel";
import type { ComposerState } from "@/components/chat/composer";

import { useAppSidebar } from "@/components/appSidebarContext";
import { useAuth } from "@/components/authProvider";
import { ActivityPanel, isActivityPart } from "@/components/chat/activityPanel";
import { Composer } from "@/components/chat/composer";
import { CopyButton } from "@/components/chat/copyButton";
import { FilePicker } from "@/components/chat/filePicker";
import { MessagePart } from "@/components/chat/messagePart";
import { RouteError } from "@/components/routeError";
import { SidebarTrigger } from "@/components/sidebar/sidebarTrigger";
import { buttonClass, iconButtonClass, pageClass, pageScrollClass } from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
	appendFileContext,
	parseFileContext,
	stripFileContext,
	useConversation,
	useUploadConversationFiles,
} from "@/hooks/useConversations";
import { createFinanceAgentClient } from "@/lib/agentClient";

export const Route = createFileRoute("/_app/chat/$sessionId")({
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: ChatRoute,
	errorComponent: RouteError,
});

const WORKING = new Set(["connecting", "submitted", "streaming"]);

type Segment =
	| { kind: "activity"; parts: ActivityPart[] }
	| { kind: "content"; part: FlueConversationPart };

/**
 * Splits a message into stretches of agent work and stretches of answer, so a
 * turn that interleaves reasoning, tools and text reads as prose with one panel
 * of steps per stretch.
 *
 * What a step *produced* — a chart, a file — is not an answer, so it does
 * not end the run: `render_finance_chart` emits its tool call and then a
 * `data-finance-chart` part, and without this the turn would break into two
 * panels with the chart wedged between them. Only prose and attachments close a
 * run; work that resumes after those genuinely is a new stretch.
 */
function toSegments(parts: FlueConversationPart[]): Segment[] {
	const segments: Segment[] = [];
	let run: Extract<Segment, { kind: "activity" }> | null = null;
	for (const part of parts) {
		if (isActivityPart(part)) {
			if (run) run.parts.push(part);
			else {
				run = { kind: "activity", parts: [part] };
				segments.push(run);
			}
			continue;
		}
		segments.push({ kind: "content", part });
		if (part.type === "text" || part.type === "file") run = null;
	}
	return segments;
}

/**
 * Memoised: every delta produces a new `messages` array, and without this each
 * one re-renders the whole transcript — re-parsing the markdown of every settled
 * turn to append a few characters to the last one. The runtime keeps canonical
 * message objects stable between deltas, so identity is the right comparison.
 */
const Message = memo(
	({ conversationId, message }: { conversationId: string; message: FlueConversationMessage }) => {
		// The runtime appends this advisory when a turn settles without a reply. It
		// is the transcript's record of an abort, so it reads as a note, not a turn.
		if (message.settlement) {
			return (
				<p className="flex items-center gap-2 text-[13px] text-muted-foreground">
					<TriangleAlert size={13} className="shrink-0" />
					{message.settlement.outcome === "aborted"
						? "Execução abortada."
						: "A execução falhou antes de responder."}
				</p>
			);
		}

		// The steps are the agent's work, not its answer — copying a reply should
		// hand over the prose alone, the way it reads on screen.
		const user = message.role === "user";
		const answer = message.parts
			.filter((part) => part.type === "text")
			.map((part) => (user ? stripFileContext(part.text) : part.text))
			.join("\n\n")
			.trim();
		const conversationFiles = user
			? message.parts.flatMap((part) =>
					part.type === "text" ? parseFileContext(part.text) : [],
				)
			: [];
		const parts = toSegments(message.parts).map((segment, index) =>
			segment.kind === "activity" ? (
				<ActivityPanel key={`activity-${index}`} parts={segment.parts} />
			) : (
				<MessagePart
					conversationId={conversationId}
					key={`part-${index}`}
					part={
						user && segment.part.type === "text"
							? { ...segment.part, text: stripFileContext(segment.part.text) }
							: segment.part
					}
				/>
			),
		);
		const attached = conversationFiles.length ? (
			<div className="mt-2 flex flex-wrap gap-1.5">
				{conversationFiles.map((file) => (
					<span
						className="rounded-md border border-border bg-background/70 px-2 py-0.5 text-xs text-muted-foreground"
						key={file.fileId}
					>
						{file.filename}
					</span>
				))}
			</div>
		) : null;
		const copy =
			answer === "" ? null : (
				<div className={`flex ${user ? "justify-end" : "justify-start"}`}>
					<CopyButton value={answer} label="Copiar mensagem" />
				</div>
			);

		// The user's copy button hangs below the bubble rather than inside it, so the
		// bubble stays pure message; it tracks the bubble's right edge because the
		// wrapper is only as wide as the bubble. The 85% cap is what makes the right
		// alignment read — a bubble spanning the column looks centred either way.
		if (user) {
			return (
				<article className="ml-auto grid w-fit max-w-[85%] gap-1">
					<div className="rounded-lg border border-border bg-card px-3 py-2 text-sm/7">
						{parts}
						{attached}
					</div>
					{copy}
				</article>
			);
		}

		return (
			<article className="grid min-w-0 gap-2.5 text-sm/7">
				{parts}
				{copy}
			</article>
		);
	},
);

Message.displayName = "Message";

/**
 * Follows the tail of the stream, but only while the reader is already there —
 * scrolling up to re-read something has to stick, even as deltas keep arriving.
 */
function useStickToBottom(messages: FlueConversationMessage[]) {
	const ref = useRef<HTMLDivElement>(null);
	const pinned = useRef(true);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const onScroll = () => {
			pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
		};
		element.addEventListener("scroll", onScroll, { passive: true });
		return () => element.removeEventListener("scroll", onScroll);
	}, []);

	// Agendado em rAF: escrever `scrollTop` no commit força layout síncrono do
	// transcript inteiro, e isso acontecia uma vez por delta.
	useEffect(() => {
		const element = ref.current;
		if (!element || !pinned.current) return;
		const frame = requestAnimationFrame(() => {
			element.scrollTop = element.scrollHeight;
		});
		return () => cancelAnimationFrame(frame);
	}, [messages]);

	return ref;
}

/** Keyed on the conversation id, so switching chats starts from clean state. */
function ChatRoute() {
	const { sessionId } = Route.useParams();
	// oxlint-disable-next-line no-use-before-define -- the session component reads better after the route
	return <ChatSession key={sessionId} sessionId={sessionId} />;
}

function ChatSession({ sessionId }: { sessionId: string }) {
	const { session } = useAuth();
	const { open } = useAppSidebar();
	const { toast } = useToast();
	const [input, setInput] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [abortRequested, setAbortRequested] = useState(false);
	const sentPending = useRef(false);
	const uploadFiles = useUploadConversationFiles();
	// Resolves the title and, more importantly, turns a stale link into a readable
	// error instead of a blank stream — the AI proxy 404s on unknown conversations.
	const conversation = useConversation(sessionId);
	const client = useMemo(() => createFinanceAgentClient(sessionId), [sessionId]);
	const agent = useFlueAgent({ client, live: "sse" });
	const isWorking = WORKING.has(agent.status);
	const scroller = useStickToBottom(agent.messages);

	// `abort()` only records the intent; the run settles to the aborted outcome
	// asynchronously, over the stream. Deriving the waiting state from the status
	// is what makes the button wait for that confirmation rather than claim the
	// run stopped the moment it was asked to.
	const aborting = abortRequested && isWorking;
	let composerState: ComposerState = "idle";
	if (aborting) composerState = "aborting";
	else if (isWorking) composerState = "working";

	// Runtime plumbing (the `finance.context` signal) is not transcript material.
	// The settlement advisory is — it is how an abort shows up in the conversation.
	const messages = agent.messages.filter(
		(message) =>
			message.display === "visible" && (message.role !== "system" || message.settlement),
	);
	const lastRole = messages.at(-1)?.role;

	// Fallback path only: the home page already sent the opening message. A key is
	// left behind just when that send failed, and then the stream may not exist yet,
	// which is why this waits for `historyReady` instead of for messages.
	useEffect(() => {
		if (!agent.historyReady || sentPending.current || !session?.user.id) return;
		const key = `pending-chat:${sessionId}`;
		const pending = sessionStorage.getItem(key);
		if (!pending) return;
		sentPending.current = true;
		sessionStorage.removeItem(key);
		void client
			.send({
				message: { kind: "user", body: pending },
			})
			.then(() => agent.refresh());
	}, [agent, client, session?.user.id, sessionId]);

	// The title was fixed at creation and the row is immutable, so sending stores nothing.
	async function send() {
		const message = input.trim();
		if (!message || !session?.user.id) return;
		setAbortRequested(false);
		try {
			const uploads = await uploadFiles(sessionId, files);
			const body = appendFileContext(message, uploads);
			if (agent.messages.length === 0) {
				await client.send({
					message: { kind: "user", body },
				});
				agent.refresh();
			} else {
				await agent.sendMessage(body);
			}
			setInput("");
			setFiles([]);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Não foi possível enviar a mensagem.",
			);
		}
	}

	async function abort() {
		setAbortRequested(true);
		try {
			const result = await client.abort();
			// Nothing was in flight, so no settlement is coming to clear the wait.
			if (!result.aborted) setAbortRequested(false);
		} catch (error) {
			setAbortRequested(false);
			toast.error(
				error instanceof Error ? error.message : "Não foi possível abortar a execução.",
			);
		}
	}

	return (
		<main className={pageClass}>
			<div className="flex h-13 shrink-0 items-center gap-3 px-3">
				{open ? null : <SidebarTrigger side="bottom" />}
				<div className="flex items-center gap-2 text-sm font-medium">
					<span className="size-1.5 rounded-full bg-positive shadow-[0_0_0_3px_color-mix(in_oklab,var(--positive)_20%,transparent)]" />
					{conversation.data?.title ?? "Analista financeiro"}
					<small className="text-xs font-normal text-muted-foreground">
						SSE · {agent.status}
					</small>
				</div>
				<div className="ml-auto flex items-center gap-1.5">
					<Tooltip label="Reconectar ao stream" side="bottom">
						<button
							className={iconButtonClass()}
							type="button"
							onClick={() => {
								setAbortRequested(false);
								agent.refresh();
							}}
							aria-label="Reconectar ao stream"
						>
							<RefreshCw size={14} />
						</button>
					</Tooltip>
				</div>
			</div>
			<div className={pageScrollClass} ref={scroller}>
				<div
					className="mx-auto grid w-[min(100%,780px)] gap-6 px-6 pt-6 pb-8"
					aria-live="polite"
				>
					{messages.map((message) => (
						<Message conversationId={sessionId} key={message.id} message={message} />
					))}
					{isWorking && lastRole !== "assistant" ? (
						<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
							<LoaderCircle size={14} className="animate-spin" />
							{aborting ? "Abortando…" : "Consultando suas finanças…"}
						</div>
					) : null}
					{conversation.error ? (
						<p className="text-[13px] text-destructive">{conversation.error.message}</p>
					) : null}
					{agent.error ? (
						<p className="text-[13px] text-destructive">{agent.error.message}</p>
					) : null}
					{agent.failedSends.map((failed) => (
						<div
							className="flex items-center gap-2.5 text-[13px] text-destructive"
							key={failed.id}
						>
							<span>Falha ao enviar “{failed.message}”.</span>
							<button
								className={buttonClass({ variant: "secondary", size: "sm" })}
								type="button"
								onClick={() => void agent.sendMessage(failed.message)}
							>
								Tentar novamente
							</button>
						</div>
					))}
				</div>
			</div>
			<Composer
				value={input}
				onChange={setInput}
				onSubmit={() => void send()}
				state={composerState}
				onAbort={() => void abort()}
				leading={
					<FilePicker
						files={files}
						onChange={setFiles}
						onError={(error) => toast.error(error)}
						disabled={isWorking}
					/>
				}
				placeholder="Faça uma pergunta de acompanhamento..."
				ariaLabel="Mensagem"
			/>
		</main>
	);
}
