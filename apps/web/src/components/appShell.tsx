import type { PropsWithChildren } from "react";

import { Link, useRouterState } from "@tanstack/react-router";
import {
	BarChart3,
	CreditCard,
	Landmark,
	LayoutDashboard,
	MessageSquare,
	Plus,
	ReceiptText,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppSidebarContext } from "@/components/appSidebarContext";
import { SettingsModal } from "@/components/settings/settingsModal";
import { LogoMark } from "@/components/ui/logoMark";
import { Tooltip } from "@/components/ui/tooltip";
import { UserMenu } from "@/components/userMenu";

/**
 * Secondary navigation lives on the primary rail; the collapsible panel next to
 * it is reserved for the AI surface, exactly like Shadow's agent sidebar.
 */
const financeNavigation = [
	{ to: "/overview", label: "Visão geral", icon: LayoutDashboard },
	{ to: "/transactions", label: "Transações", icon: ReceiptText },
	{ to: "/cards", label: "Cartões", icon: CreditCard },
	{ to: "/investments", label: "Investimentos", icon: BarChart3 },
	{ to: "/open-finance", label: "Open Finance", icon: Landmark },
] as const;

export function AppShell({ children }: PropsWithChildren) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
	const [open, setOpen] = useState(() => localStorage.getItem("sidebar") !== "collapsed");
	const [settingsOpen, setSettingsOpen] = useState(false);

	const toggle = useCallback(() => {
		setOpen((value) => {
			localStorage.setItem("sidebar", value ? "collapsed" : "open");
			return !value;
		});
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey)) return;
			if (event.key === "b") {
				event.preventDefault();
				toggle();
			}
			if (event.key === "k") {
				event.preventDefault();
				setSettingsOpen(true);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggle]);

	const sidebar = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);
	const closeSettings = useCallback(() => setSettingsOpen(false), []);

	return (
		<AppSidebarContext value={sidebar}>
			<div className="flex h-svh overflow-hidden">
				<nav
					// `relative z-40`: the rail's flyouts (user menu, tooltips) escape into
					// the page area, which comes later in the DOM and would paint over them.
					className="relative z-40 flex w-[var(--rail-width)] shrink-0 flex-col justify-between border-r border-border bg-card p-3"
					aria-label="Navegação principal"
				>
					<div className="flex flex-col gap-6">
						<Link
							className="grid size-7 place-items-center text-foreground"
							to="/chat"
							aria-label="Início"
						>
							<LogoMark />
						</Link>
						<div className="flex flex-col gap-3">
							<Tooltip label="Novo chat" side="right">
								<Link
									className="grid size-7 place-items-center rounded-md border border-transparent bg-primary p-0 text-primary-foreground shadow-[var(--shadow-xs)] transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_90%,transparent)]"
									to="/chat"
									aria-label="Novo chat"
								>
									<Plus size={16} />
								</Link>
							</Tooltip>
							<span className="h-px w-full bg-border" />
							<Tooltip label="Assistente" shortcut="⌘B" side="right">
								<Link
									className="grid size-7 place-items-center rounded-md border border-transparent bg-transparent p-0 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground data-[active=true]:hover:bg-sidebar-border"
									to="/chat"
									data-active={isChat}
									aria-label="Assistente"
									onClick={(event) => {
										if (isChat) {
											event.preventDefault();
											toggle();
										} else {
											setOpen(true);
										}
									}}
								>
									<MessageSquare size={16} />
								</Link>
							</Tooltip>
							{financeNavigation.map(({ icon: Icon, label, to }) => (
								<Tooltip key={to} label={label} side="right">
									<Link
										className="grid size-7 place-items-center rounded-md border border-transparent bg-transparent p-0 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground data-[active=true]:hover:bg-sidebar-border"
										to={to}
										data-active={pathname === to}
										aria-label={label}
									>
										<Icon size={16} />
									</Link>
								</Tooltip>
							))}
						</div>
					</div>
					<div className="flex flex-col gap-3">
						<UserMenu onOpenSettings={() => setSettingsOpen(true)} />
					</div>
				</nav>
				<div className="flex min-w-0 flex-1 overflow-hidden">{children}</div>
				<SettingsModal open={settingsOpen} onClose={closeSettings} />
			</div>
		</AppSidebarContext>
	);
}
