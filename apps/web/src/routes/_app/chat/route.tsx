import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RouteError } from "@/components/routeError";
import { ChatSidebar } from "@/components/sidebar/chatSidebar";

export const Route = createFileRoute("/_app/chat")({
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: ChatLayout,
	errorComponent: RouteError,
});

/** Only the AI surface gets a sub-sidebar; finance sections render without one. */
function ChatLayout() {
	return (
		<div className="flex min-w-0 flex-1 overflow-hidden">
			<ChatSidebar />
			<Outlet />
		</div>
	);
}
