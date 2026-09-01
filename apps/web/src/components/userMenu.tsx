import { useRouter } from "@tanstack/react-router";
import { Check, ChevronRight, Landmark, LogOut, Moon, Palette, Settings, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/authProvider";
import { useConnection } from "@/components/connectionProvider";
import { useTheme } from "@/components/themeProvider";
import { useAvatarSrc } from "@/components/ui/avatar";
import {
	kbdClass,
	menuClass,
	menuItemClass,
	menuLabelClass,
	menuSeparatorClass,
} from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { useFinanceConnections } from "@/hooks/useFinanceConnections";
import { authClient } from "@/lib/authClient";

const themeOptions = [
	{ value: "light", label: "Claro", icon: Sun },
	{ value: "dark", label: "Escuro", icon: Moon },
] as const;

export function UserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
	const { session } = useAuth();
	const { theme, setTheme } = useTheme();
	const { connectionId, selectConnection } = useConnection();
	const connections = useFinanceConnections();
	const { toast } = useToast();
	const avatarSrc = useAvatarSrc(session?.user.image);
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	/**
	 * Closes the menu on selection, unlike the theme flyout: picking a connection
	 * refetches every finance screen, so leaving the menu hovering over the reload
	 * reads as broken.
	 */
	async function pickConnection(next: string | null) {
		setOpen(false);
		try {
			await selectConnection(next);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Não foi possível trocar a conexão.",
			);
		}
	}

	async function signOut() {
		setOpen(false);
		await authClient.signOut();
		await router.navigate({ to: "/auth/sign-in", search: {}, replace: true });
		await router.invalidate();
	}

	return (
		<div className="relative flex" ref={containerRef}>
			<button
				className="grid size-7 cursor-pointer place-items-center overflow-hidden rounded-md border-0 bg-sidebar-accent p-0 text-xs font-medium text-muted-foreground uppercase opacity-100 transition-opacity select-none hover:opacity-85 [&_img]:size-full [&_img]:object-cover"
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="Conta"
				onClick={() => setOpen((value) => !value)}
			>
				{avatarSrc ? (
					<img src={avatarSrc} alt="" />
				) : (
					(session?.user.name?.slice(0, 1) ?? "U")
				)}
			</button>
			{open ? (
				<div
					className={`${menuClass} absolute bottom-0 left-[calc(100%+8px)] z-50`}
					role="menu"
				>
					<div className="grid gap-px px-2 py-1.5">
						<strong className="text-sm font-medium">{session?.user.name}</strong>
						<small className="max-w-50 truncate text-[13px] text-muted-foreground">
							{session?.user.email}
						</small>
					</div>
					<div className={menuSeparatorClass} />
					<div className="group/submenu relative">
						<button className={menuItemClass} type="button" aria-haspopup="menu">
							<Palette size={14} />
							<span className={menuLabelClass}>Tema</span>
							<ChevronRight size={14} />
						</button>
						<div
							className={`${menuClass} absolute bottom-[-5px] left-[calc(100%+6px)] hidden min-w-39 before:absolute before:inset-y-0 before:-left-2 before:w-2 before:content-[''] group-hover/submenu:flex group-has-[:focus-visible]/submenu:flex`}
							role="menu"
						>
							{themeOptions.map(({ icon: Icon, label, value }) => (
								<button
									key={value}
									className={menuItemClass}
									type="button"
									role="menuitemradio"
									aria-checked={theme === value}
									data-selected={theme === value}
									onClick={() => setTheme(value)}
								>
									<Icon size={14} />
									<span className={menuLabelClass}>{label}</span>
									{theme === value ? <Check size={14} /> : null}
								</button>
							))}
						</div>
					</div>
					<div className="group/submenu relative">
						<button className={menuItemClass} type="button" aria-haspopup="menu">
							<Landmark size={14} />
							<span className={menuLabelClass}>Conexão</span>
							<ChevronRight size={14} />
						</button>
						<div
							className={`${menuClass} absolute bottom-[-5px] left-[calc(100%+6px)] hidden min-w-39 before:absolute before:inset-y-0 before:-left-2 before:w-2 before:content-[''] group-hover/submenu:flex group-has-[:focus-visible]/submenu:flex`}
							role="menu"
						>
							{connections.data?.length ? (
								connections.data.map((connection) => (
									<button
										key={connection.id}
										className={menuItemClass}
										type="button"
										role="menuitemradio"
										aria-checked={connectionId === connection.id}
										data-selected={connectionId === connection.id}
										onClick={() => void pickConnection(connection.id)}
									>
										<Landmark size={14} />
										<span className={menuLabelClass}>
											{connection.name} · {connection.id.slice(0, 8)}
										</span>
										{connectionId === connection.id ? (
											<Check size={14} />
										) : null}
									</button>
								))
							) : (
								<span className="block px-2.5 py-[0.45rem] text-[0.8rem] text-muted-foreground">
									Nenhuma conexão cadastrada.
								</span>
							)}
							{connectionId === null ? null : (
								<>
									<div className={menuSeparatorClass} />
									<button
										className={menuItemClass}
										type="button"
										onClick={() => void pickConnection(null)}
									>
										<span className={menuLabelClass}>Limpar seleção</span>
									</button>
								</>
							)}
						</div>
					</div>
					<button
						className={menuItemClass}
						type="button"
						onClick={() => {
							setOpen(false);
							onOpenSettings();
						}}
					>
						<Settings size={14} />
						<span className={menuLabelClass}>Configurações</span>
						<span className={kbdClass}>⌘K</span>
					</button>
					<div className={menuSeparatorClass} />
					<button
						className={`${menuItemClass} text-destructive hover:bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)] hover:text-destructive`}
						type="button"
						onClick={signOut}
					>
						<LogOut size={14} />
						<span className={menuLabelClass}>Sair</span>
					</button>
				</div>
			) : null}
		</div>
	);
}
