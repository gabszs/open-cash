import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { MessageSquare, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppSidebar } from "@/components/appSidebarContext";
import { ConversationFiles } from "@/components/sidebar/conversationFiles";
import { SidebarTrigger } from "@/components/sidebar/sidebarTrigger";
import { iconButtonClass, inputClass } from "@/components/ui/styles";
import { Tooltip } from "@/components/ui/tooltip";
import { useConversations } from "@/hooks/useConversations";

const relativeTime = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/**
 * Conversation rows are immutable, so `createdAt` is all there is — the label
 * says "criada" rather than implying last activity.
 */
function formatCreatedAt(value: string) {
	const elapsed = Date.now() - new Date(value).getTime();
	const minutes = Math.round(elapsed / 60_000);
	if (minutes < 60) return relativeTime.format(-minutes, "minute");
	const hours = Math.round(minutes / 60);
	if (hours < 24) return relativeTime.format(-hours, "hour");
	return relativeTime.format(-Math.round(hours / 24), "day");
}

/**
 * One-time cleanup of the pre-server chat index. Those ids use the old
 * `u_<base64url(userId)>.<uuid v4>` format and have no row in `conversations`,
 * so nothing can open them again.
 */
function purgeLegacyChatSessions() {
	for (const key of Object.keys(localStorage)) {
		if (key.startsWith("finance-chat-sessions:")) localStorage.removeItem(key);
	}
}

/**
 * The panel next to the rail is dedicated to the AI surface only — finance
 * sections navigate straight from the rail and render without a sub-sidebar.
 */
export function ChatSidebar() {
	const { open } = useAppSidebar();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	// Undefined outside a session route, which is what tells the files section that
	// there is no conversation to list.
	const { sessionId } = useParams({ strict: false });
	const conversations = useConversations("finance");
	const [query, setQuery] = useState("");

	useEffect(purgeLegacyChatSessions, []);

	// Filtering stays client-side: the list route has no search parameter.
	const visibleSessions = useMemo(() => {
		const items = conversations.data ?? [];
		const term = query.trim().toLowerCase();
		if (!term) return items;
		return items.filter((item) => item.title.toLowerCase().includes(term));
	}, [conversations.data, query]);

	/** Null once there are rows to render; otherwise the reason there are none. */
	const placeholder = (() => {
		if (conversations.isPending) return "Carregando conversas…";
		if (conversations.error) return conversations.error.message;
		if (visibleSessions.length > 0) return null;
		return query ? `Nenhuma conversa encontrada para “${query}”.` : "Nenhuma conversa ativa.";
	})();

	return (
		<aside
			className="w-[var(--sub-sidebar-width)] shrink-0 overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-[var(--ease-out-quart)] data-[state=collapsed]:w-0 data-[state=collapsed]:border-r-0 max-wide:[--sub-sidebar-width:17rem] max-shell:fixed max-shell:inset-y-0 max-shell:left-[var(--rail-width)] max-shell:z-40 max-shell:shadow-[var(--shadow-lg)]"
			data-state={open ? "expanded" : "collapsed"}
			aria-label="Conversas do assistente"
			aria-hidden={!open}
			inert={open ? undefined : true}
		>
			<div className="flex h-full w-[var(--sub-sidebar-width)] flex-col py-3 max-wide:[--sub-sidebar-width:17rem]">
				<div className="flex h-7 shrink-0 items-center justify-between gap-1.5 px-3">
					<strong className="truncate text-sm font-medium select-none">Assistente</strong>
					<SidebarTrigger />
				</div>
				<div className="mt-6 flex gap-2 px-3">
					<div className="relative flex flex-1 items-center">
						<Search
							className="pointer-events-none absolute left-2 text-muted-foreground"
							size={14}
						/>
						<input
							className={`${inputClass} h-8 px-7`}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Buscar conversas..."
							aria-label="Buscar conversas"
						/>
						{query ? (
							<button
								className={iconButtonClass({
									size: "xs",
									className: "absolute right-1",
								})}
								type="button"
								onClick={() => setQuery("")}
								aria-label="Limpar busca"
							>
								<X size={14} />
							</button>
						) : null}
					</div>
					<Tooltip label="Novo chat" side="bottom" align="end">
						<Link
							className={iconButtonClass({
								variant: "outline",
								size: "md",
								className:
									"bg-[color-mix(in_oklab,var(--input)_40%,transparent)] hover:bg-accent",
							})}
							to="/chat"
							aria-label="Novo chat"
						>
							<Plus size={15} />
						</Link>
					</Tooltip>
				</div>
				<ConversationFiles conversationId={sessionId} />
				<div className="mt-4 flex min-h-0 flex-1 flex-col px-3">
					<span className="flex h-7 items-center text-xs font-medium text-muted-foreground select-none">
						Conversas
					</span>
					<div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{placeholder ? (
							<p className="px-2 py-1 text-[13px] leading-5 text-muted-foreground">
								{placeholder}
							</p>
						) : (
							visibleSessions.map((item) => (
								<div
									className="relative flex items-center rounded-md hover:bg-sidebar-accent focus-within:bg-sidebar-accent"
									key={item.id}
								>
									<Link
										className="grid min-w-0 flex-1 gap-px rounded-md px-2 py-1.5 text-sm text-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium [&>span]:truncate [&>small]:flex [&>small]:items-center [&>small]:gap-1 [&>small]:text-xs [&>small]:text-muted-foreground"
										to="/chat/$sessionId"
										params={{ sessionId: item.id }}
										data-active={pathname === `/chat/${item.id}`}
									>
										<span>{item.title}</span>
										<small>
											<MessageSquare size={11} />
											criada {formatCreatedAt(item.createdAt)}
										</small>
									</Link>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</aside>
	);
}
