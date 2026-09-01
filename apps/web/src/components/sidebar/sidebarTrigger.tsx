import { PanelLeft } from "lucide-react";

import { useAppSidebar } from "@/components/appSidebarContext";
import { iconButtonClass } from "@/components/ui/styles";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Shadow keeps a single toggle that moves with the panel: docked inside the
 * sidebar header while expanded, and out on the page top bar once collapsed.
 */
export function SidebarTrigger({ side = "right" }: { side?: "right" | "bottom" }) {
	const { open, toggle } = useAppSidebar();

	return (
		<Tooltip label={open ? "Recolher painel" : "Expandir painel"} shortcut="⌘B" side={side}>
			<button
				className={iconButtonClass()}
				type="button"
				onClick={toggle}
				aria-label={open ? "Recolher painel" : "Expandir painel"}
				aria-expanded={open}
			>
				<PanelLeft size={16} />
			</button>
		</Tooltip>
	);
}
