import type { ReactNode } from "react";

import { ArrowUp, LoaderCircle, Square } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

/**
 * `working` covers the whole span from "submitted" to the last delta; `aborting`
 * is the gap between asking for an abort and the runtime confirming it, which
 * arrives asynchronously over the stream.
 */
export type ComposerState = "idle" | "working" | "aborting";

interface ComposerProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	state: ComposerState;
	/** Omit on surfaces with nothing to abort — the button then just waits. */
	onAbort?: () => void;
	placeholder: string;
	ariaLabel: string;
	variant?: "inline" | "stacked";
	/** Extra controls on the action row, left of the send button. */
	leading?: ReactNode;
	autoFocus?: boolean;
}

// The legacy sheet still styles bare `input`/`textarea`; these win because
// utilities sit in a later layer, but every property it sets has to be named.
const textareaClass =
	"w-full resize-none rounded-none border-0 bg-transparent p-2 text-sm shadow-none outline-none focus-visible:shadow-none focus-visible:outline-none";

const stackedFormClass =
	"flex flex-col rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-sm)] focus-within:border-[var(--sidebar-border)]";
const inlineFormClass =
	"mx-auto mb-4 flex w-[min(100%,780px)] shrink-0 flex-col rounded-xl border border-border bg-card/90 p-2 shadow-[var(--shadow-md)] backdrop-blur-md focus-within:border-[var(--sidebar-border)]";

function ButtonIcon({ waiting, stop }: { waiting: boolean; stop: boolean }) {
	if (waiting) return <LoaderCircle size={16} className="animate-spin" />;
	if (stop) return <Square size={12} fill="currentColor" />;
	return <ArrowUp size={16} />;
}

/**
 * One button holding the whole send/abort cycle, so the control never moves:
 * empty draft → disabled arrow; draft → arrow; in flight → stop; abort asked
 * for → spinner until the runtime confirms, then back to the disabled arrow.
 */
function ComposerButton({
	value,
	state,
	onAbort,
}: Pick<ComposerProps, "value" | "state" | "onAbort">) {
	const canAbort = state === "working" && onAbort !== undefined;
	const waiting = state === "aborting" || (state === "working" && !canAbort);
	const disabled = waiting || (state === "idle" && value.trim() === "");

	return (
		<button
			type={canAbort ? "button" : "submit"}
			onClick={canAbort ? onAbort : undefined}
			disabled={disabled}
			aria-label={canAbort ? "Abortar execução" : "Enviar"}
			// `border-0` is not decoration: the entry sheet drops Tailwind's preflight,
			// so an unnamed border keeps the browser's native button bevel.
			className="grid size-8 shrink-0 place-items-center rounded-md border-0 bg-primary p-0 text-primary-foreground transition-opacity disabled:pointer-events-none disabled:opacity-35"
		>
			<ButtonIcon waiting={waiting} stop={canAbort} />
		</button>
	);
}

export function Composer({
	value,
	onChange,
	onSubmit,
	state,
	onAbort,
	placeholder,
	ariaLabel,
	variant = "inline",
	leading,
	autoFocus,
}: ComposerProps) {
	const textarea = useRef<HTMLTextAreaElement>(null);
	const minHeight = variant === "inline" ? 36 : 60;

	useLayoutEffect(() => {
		const element = textarea.current;
		if (!element) return;
		element.style.height = "auto";
		element.style.height = `${Math.max(minHeight, Math.min(element.scrollHeight, 160))}px`;
	}, [value, minHeight]);

	const button = <ComposerButton value={value} state={state} onAbort={onAbort} />;

	const field = (
		<textarea
			ref={textarea}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={(event) => {
				// Enter only ever sends. While the agent works there is no send to
				// make — the button is a stop button, and the draft stays put.
				if (event.key !== "Enter" || event.shiftKey) return;
				event.preventDefault();
				if (state === "idle") onSubmit();
			}}
			placeholder={placeholder}
			aria-label={ariaLabel}
			autoFocus={autoFocus}
			className={textareaClass}
			style={{ minHeight, maxHeight: 160 }}
		/>
	);

	// Both variants share one action row so the send button always sits on the
	// same baseline as the attachment button, never floating beside the textarea.
	return (
		<form
			className={variant === "stacked" ? stackedFormClass : inlineFormClass}
			onSubmit={(event) => {
				event.preventDefault();
				if (state === "idle") onSubmit();
			}}
		>
			{field}
			<div className="flex items-center justify-between gap-2 pt-1">
				<div className="flex flex-wrap items-center gap-1.5">{leading}</div>
				{button}
			</div>
		</form>
	);
}
