import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const RESET_MS = 1600;

interface CopyButtonProps {
	value: string;
	/** Merged after the base styles, for placement and hover-reveal. */
	className?: string;
	label?: string;
}

/**
 * Copy-to-clipboard with a confirmation the eye can catch: the icon swaps to a
 * check that pops in, then falls back on its own.
 *
 * `preventDefault` matters — one of these sits inside a `<summary>`, where a
 * click would otherwise toggle the step open.
 */
export function CopyButton({ value, className = "", label = "Copiar" }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);
	// A plain number, not `useRef<Timeout>()`: the lint autofix strips the
	// `undefined` argument React 19's typings require.
	const timer = useRef(0);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			return;
		}
		setCopied(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setCopied(false), RESET_MS);
	}

	return (
		<button
			type="button"
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void copy();
			}}
			aria-label={copied ? "Copiado" : label}
			className={`grid size-6 shrink-0 place-items-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-card hover:text-foreground ${className}`}
		>
			{copied ? <Check size={13} className="animate-pop-check" /> : <Copy size={13} />}
		</button>
	);
}
