import type { ReactNode } from "react";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/classNames";

export const compactModalClass =
	"h-fit flex-col gap-4 p-5 [--modal-backdrop:rgb(0_0_0/0.2)] [&_h2]:m-0 [&_h2]:text-[15px] [&_h2]:font-medium [&>p]:m-0 [&>p]:text-[13px] [&>p]:leading-6 [&>p]:text-muted-foreground";

const modalSizeClass = {
	default: "max-w-[672px]",
	compact: "max-w-[420px]",
	form: "max-w-[600px]",
} as const;

/**
 * Overlay dialog rendered above the current screen, mirroring Shadow's settings
 * modal: dimmed backdrop, bordered card, escape/backdrop dismissal. Uses the
 * native top layer so the app shell's `overflow: hidden` cannot clip it.
 */
export function Modal({
	open,
	onClose,
	labelledBy,
	className = "",
	size = "default",
	showClose = true,
	children,
}: {
	open: boolean;
	onClose: () => void;
	labelledBy: string;
	className?: string;
	size?: keyof typeof modalSizeClass;
	showClose?: boolean;
	children: ReactNode;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	// Backdrop clicks land on the dialog box itself; Escape is covered by onCancel.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog || !open) return;
		const onBackdropClick = (event: MouseEvent) => {
			if (event.target === dialog) onClose();
		};
		dialog.addEventListener("click", onBackdropClick);
		return () => dialog.removeEventListener("click", onBackdropClick);
	}, [open, onClose]);

	return (
		<dialog
			className={cn(
				"fixed inset-0 m-auto h-[600px] max-h-[calc(100%-32px)] w-[calc(100%-32px)] overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground shadow-[var(--shadow-lg)] [--modal-backdrop:rgb(0_0_0/0.5)] open:flex open:animate-[pop-in_0.15s_var(--ease-out-quart)] max-shell:max-h-full max-shell:flex-col [&::backdrop]:animate-fade-in [&::backdrop]:bg-[var(--modal-backdrop)]",
				modalSizeClass[size],
				className,
			)}
			ref={dialogRef}
			aria-labelledby={labelledBy}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
		>
			{children}
			{showClose ? (
				<button
					className="absolute top-3.5 right-3.5 z-1 grid size-6 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
					type="button"
					onClick={onClose}
					aria-label="Fechar"
				>
					<X size={16} />
				</button>
			) : null}
			{/* `showModal()` inerts everything outside the dialog, so toasts fired from
			    within it have to render inside the dialog to stay clickable. */}
			{open ? <ToastViewport inModal /> : null}
		</dialog>
	);
}
