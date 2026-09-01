import type { ReactNode } from "react";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Gap left between the icon and the box, bridged by the popover pseudo-element. */
const GAP = 8;
/** Breathing room kept against the viewport edges. */
const EDGE = 16;
/** Mirrors the `max-width` in the stylesheet — only used to clamp the left edge. */
const MAX_WIDTH = 320;

/**
 * Supporting information tucked behind an icon, revealed on hover — the same box
 * a `.callout` would render, floating just above the icon.
 *
 * Everything here is phrasing content on purpose: the component is rendered inside
 * `<small>` and `<strong>`, so no `<div>`/`<p>` is allowed.
 *
 * Open/close lives in state instead of a `:hover` rule so both inputs share one
 * source of truth — a CSS hover could not close a popover a tap had pinned open.
 * Pointer enter/leave is the desktop path, `:focus-visible` covers the keyboard, and
 * the tap toggle covers touch, where iOS Safari never focuses a `<button>` on tap and
 * the content would otherwise be unreachable.
 */
export function InfoHint({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
	const trigger = useRef<HTMLButtonElement>(null);
	const [origin, setOrigin] = useState<{ left: number; top: number }>();
	const open = Boolean(origin);

	/**
	 * Viewport coordinates, not an offset inside the section header: the box has to
	 * sit above the icon, and the settings panel scrolls, so anything reaching past
	 * the header's top edge would be clipped by that scroller.
	 */
	function reveal() {
		const rect = trigger.current?.getBoundingClientRect();
		if (!rect) return;
		setOrigin({
			left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - MAX_WIDTH - EDGE)),
			top: rect.top - GAP,
		});
	}

	/** A fixed box neither travels with the scroller nor reflows with the viewport. */
	useEffect(() => {
		if (!open) return;
		const hide = () => setOrigin(undefined);
		window.addEventListener("scroll", hide, { capture: true, passive: true });
		window.addEventListener("resize", hide);
		return () => {
			window.removeEventListener("scroll", hide, { capture: true });
			window.removeEventListener("resize", hide);
		};
	}, [open]);

	return (
		<span
			className="inline-flex items-center align-middle"
			// Leave does not fire while the pointer moves onto the box: it is a DOM child
			// of this span, however far the fixed positioning takes it.
			onPointerEnter={(event) => {
				if (event.pointerType !== "touch") reveal();
			}}
			onPointerLeave={(event) => {
				if (event.pointerType !== "touch") setOrigin(undefined);
			}}
		>
			<button
				ref={trigger}
				className="inline-flex cursor-pointer border-0 bg-transparent py-0 pr-0 pl-1 text-muted-foreground hover:text-foreground"
				type="button"
				aria-label="Mais informações"
				aria-expanded={open}
				onClick={() => (open ? setOrigin(undefined) : reveal())}
				// A tap focuses the button too, and revealing here would race the click
				// toggle into closing it again — so only the keyboard path opens on focus.
				onFocus={(event) => {
					if (event.currentTarget.matches(":focus-visible")) reveal();
				}}
				onBlur={() => setOrigin(undefined)}
				onKeyDown={(event) => {
					if (event.key === "Escape") setOrigin(undefined);
				}}
			>
				<Info size={13} />
			</button>
			{origin ? (
				<span
					className="fixed z-60 flex max-w-80 -translate-y-full animate-pop-in items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-left text-xs leading-[1.55] font-normal text-muted-foreground shadow-[var(--shadow-lg)] before:absolute before:inset-x-0 before:top-full before:h-2 before:content-[''] [&>svg]:mt-px [&>svg]:shrink-0 [&_code]:text-foreground"
					role="tooltip"
					style={origin}
				>
					{icon}
					<span>{children}</span>
				</span>
			) : null}
		</span>
	);
}
