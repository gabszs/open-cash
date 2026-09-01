import type { ReactNode } from "react";

import { cn } from "@/lib/classNames";

type Side = "top" | "right" | "bottom" | "left";
type Align = "center" | "end";

/**
 * Hover/focus tooltip in the Shadow style: a bordered card with an optional
 * keyboard shortcut chip. Hidden below the `md` breakpoint, like the original.
 *
 * `align` only applies to the `top`/`bottom` sides, which are centred on the
 * trigger by default. Pass `end` when the trigger sits against the right edge
 * of a clipping container — the sidebar hides its overflow so it can collapse
 * to `width: 0`, so a centred label there gets cut in half.
 */
export function Tooltip({
	label,
	shortcut,
	side = "right",
	align = "center",
	children,
}: {
	label: string;
	shortcut?: string;
	side?: Side;
	align?: Align;
	children: ReactNode;
}) {
	const position = {
		top: "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
		right: "top-1/2 left-[calc(100%+8px)] -translate-y-1/2",
		bottom: "top-[calc(100%+8px)] left-1/2 -translate-x-1/2",
		left: "top-1/2 right-[calc(100%+8px)] -translate-y-1/2",
	} satisfies Record<Side, string>;
	const endAligned =
		align === "end" && (side === "top" || side === "bottom")
			? "right-0 left-auto translate-x-0"
			: "";

	return (
		<span className="group/tooltip relative inline-flex">
			{children}
			<span
				className={cn(
					"pointer-events-none absolute z-60 hidden h-7 animate-pop-in items-center gap-2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar-accent px-2 text-xs text-muted-foreground shadow-[var(--shadow-sm)] md:group-hover/tooltip:flex md:group-focus-visible/tooltip:flex md:group-focus-within/tooltip:flex",
					position[side],
					endAligned,
				)}
				data-side={side}
				data-align={align}
				role="tooltip"
			>
				{label}
				{shortcut ? (
					<span className="-mr-1 inline-flex h-5 items-center rounded-sm border border-b-2 border-sidebar-border bg-gradient-to-t from-sidebar-accent to-transparent px-1 text-[11px] leading-none">
						{shortcut}
					</span>
				) : null}
			</span>
		</span>
	);
}
