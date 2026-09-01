import { createContext, use } from "react";

/**
 * The context lives apart from `AppShell` on purpose. React Fast Refresh only
 * treats a module as a refresh boundary when every export is a component, so
 * keeping this hook next to the shell made that module ineligible — an HMR pass
 * would re-execute it, mint a fresh context object, and leave the mounted
 * provider behind, which surfaces as "useAppSidebar must be used inside
 * AppShell" on a page that renders fine after a reload.
 */
export interface AppSidebarContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
}

export const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

export function useAppSidebar() {
	const context = use(AppSidebarContext);
	if (!context) {
		throw new Error("useAppSidebar must be used inside AppShell");
	}
	return context;
}
