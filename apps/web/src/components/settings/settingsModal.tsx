import { BookOpen, Cloud, KeyRound, ShieldCheck, UserCog, Users } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/authProvider";
import { AdminSettings } from "@/components/settings/adminSettings";
import { ApiKeySettings } from "@/components/settings/apiKeySettings";
import { ConnectionSettings } from "@/components/settings/connectionSettings";
import { ProfileSettings } from "@/components/settings/profileSettings";
import { RouteSettings } from "@/components/settings/routeSettings";
import { SecuritySettings } from "@/components/settings/securitySettings";
import { Modal } from "@/components/ui/modal";

type Tab = "profile" | "security" | "api-keys" | "connections" | "routes" | "admin";

const tabs = [
	{ value: "profile", label: "Perfil", title: "Perfil", icon: UserCog },
	{ value: "security", label: "Segurança", title: "Auth e sessões", icon: ShieldCheck },
	{ value: "api-keys", label: "API keys", title: "API keys", icon: KeyRound },
	{ value: "connections", label: "Open Finance", title: "Open Finance", icon: Cloud },
	{ value: "routes", label: "Rotas", title: "Rotas e integrações", icon: BookOpen },
] as const satisfies readonly { value: Tab; label: string; title: string; icon: typeof UserCog }[];

const adminTab = { value: "admin", label: "Admin", title: "Administração", icon: Users } as const;

/** Settings open as an overlay above the current screen, the way Shadow does it. */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { session } = useAuth();
	const [tab, setTab] = useState<Tab>("profile");
	const isAdmin = String((session?.user as { role?: string } | undefined)?.role ?? "user")
		.split(",")
		.includes("admin");
	const visibleTabs = isAdmin ? [...tabs, adminTab] : tabs;
	const activeTab = tab === "admin" && !isAdmin ? "profile" : tab;
	const current = visibleTabs.find((item) => item.value === activeTab) ?? tabs[0];

	return (
		<Modal open={open} onClose={onClose} labelledBy="settings-modal-title">
			<div className="flex w-40 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-2 py-4 max-shell:w-full max-shell:flex-row max-shell:items-center max-shell:gap-2 max-shell:border-r-0 max-shell:border-b max-shell:px-3 max-shell:py-2.5">
				<h2
					className="mb-4 px-2 text-base font-medium max-shell:m-0 max-shell:p-0"
					id="settings-modal-title"
				>
					Configurações
				</h2>
				<div className="flex flex-col gap-1 max-shell:flex-1 max-shell:flex-row max-shell:overflow-x-auto">
					{visibleTabs.map(({ icon: Icon, label, value }) => (
						<button
							key={value}
							className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-transparent bg-transparent px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[active=true]:border-sidebar-border data-[active=true]:bg-accent data-[active=true]:text-foreground max-shell:shrink-0 [&>svg]:shrink-0"
							type="button"
							data-active={activeTab === value}
							onClick={() => setTab(value)}
						>
							<Icon size={15} />
							{label}
						</button>
					))}
				</div>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-6">
				<h3 className="px-4 pt-4 text-sm font-medium">{current.title}</h3>
				<div className="flex flex-1 flex-col items-start gap-6 overflow-y-auto px-4 pb-4 text-sm [scrollbar-gutter:stable]">
					{activeTab === "profile" ? <ProfileSettings /> : null}
					{activeTab === "security" ? <SecuritySettings /> : null}
					{activeTab === "api-keys" ? <ApiKeySettings /> : null}
					{activeTab === "connections" ? <ConnectionSettings /> : null}
					{activeTab === "routes" ? <RouteSettings /> : null}
					{activeTab === "admin" && isAdmin ? <AdminSettings /> : null}
				</div>
			</div>
		</Modal>
	);
}
