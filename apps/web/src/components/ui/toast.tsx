import type { PropsWithChildren } from "react";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, use, useCallback, useEffect, useId, useMemo, useState } from "react";

type ToastVariant = "success" | "error";

interface ToastItem {
	id: string;
	message: string;
	variant: ToastVariant;
}

interface ToastContextValue {
	dismiss: (id: string) => void;
	hosts: string[];
	publish: (variant: ToastVariant, message: string) => void;
	registerHost: (id: string) => () => void;
	toasts: ToastItem[];
}

const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 3;

let sequence = 0;

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Feedback for user-triggered API calls. Toasts are rendered by a `ToastViewport`,
 * which exists twice: once globally and once inside `Modal`. A native `<dialog>`
 * opened with `showModal()` makes the rest of the document inert, so a toast fired
 * from inside a modal has to be a descendant of that dialog to stay interactive.
 * The `hosts` stack decides which viewport is the live one.
 */
export function ToastProvider({ children }: PropsWithChildren) {
	const [toasts, setToasts] = useState<ToastItem[]>([]);
	const [hosts, setHosts] = useState<string[]>([]);

	const dismiss = useCallback((id: string) => {
		setToasts((current) => current.filter((item) => item.id !== id));
	}, []);

	const publish = useCallback((variant: ToastVariant, message: string) => {
		sequence += 1;
		const id = `toast-${sequence}`;
		setToasts((current) => [...current, { id, message, variant }].slice(-MAX_VISIBLE));
	}, []);

	const registerHost = useCallback((id: string) => {
		setHosts((current) => [...current, id]);
		return () => setHosts((current) => current.filter((host) => host !== id));
	}, []);

	const value = useMemo(
		() => ({ dismiss, hosts, publish, registerHost, toasts }),
		[dismiss, hosts, publish, registerHost, toasts],
	);

	return <ToastContext value={value}>{children}</ToastContext>;
}

function useToastContext() {
	const context = use(ToastContext);
	if (!context) {
		throw new Error("useToast must be used inside ToastProvider");
	}
	return context;
}

export function useToast() {
	const { publish } = useToastContext();
	return useMemo(
		() => ({
			toast: {
				error: (message: string) => publish("error", message),
				success: (message: string) => publish("success", message),
			},
		}),
		[publish],
	);
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
	const Icon = item.variant === "success" ? CircleCheck : CircleAlert;

	useEffect(() => {
		const timer = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
		return () => clearTimeout(timer);
	}, [item.id, onDismiss]);

	return (
		<div
			className="pointer-events-auto grid w-80 max-w-[calc(100vw-32px)] animate-pop-in grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2.5 text-[13px] leading-[1.45] text-foreground shadow-[var(--shadow-lg)] data-[variant=error]:border-[color-mix(in_oklab,var(--destructive)_40%,var(--sidebar-border))] data-[variant=success]:border-[color-mix(in_oklab,var(--positive)_40%,var(--sidebar-border))] [&>svg]:mt-px [&>svg]:shrink-0 data-[variant=error]:[&>svg]:text-destructive data-[variant=success]:[&>svg]:text-positive"
			data-variant={item.variant}
		>
			<Icon size={15} />
			<span>{item.message}</span>
			<button
				className="grid size-5 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
				type="button"
				onClick={() => onDismiss(item.id)}
				aria-label="Fechar aviso"
			>
				<X size={13} />
			</button>
		</div>
	);
}

export function ToastViewport({ inModal = false }: { inModal?: boolean }) {
	const { dismiss, hosts, registerHost, toasts } = useToastContext();
	const hostId = useId();

	useEffect(() => {
		if (!inModal) return;
		return registerHost(hostId);
	}, [hostId, inModal, registerHost]);

	// The innermost modal wins; the global viewport only renders when no modal is open.
	const isActive = inModal ? hosts.at(-1) === hostId : hosts.length === 0;
	if (!isActive || toasts.length === 0) {
		return null;
	}

	return (
		<output
			className="pointer-events-none fixed right-4 bottom-4 z-70 flex flex-col gap-2"
			aria-live="polite"
		>
			{toasts.map((item) => (
				<ToastRow key={item.id} item={item} onDismiss={dismiss} />
			))}
		</output>
	);
}
