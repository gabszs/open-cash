import type { ReactNode } from "react";

import { useId } from "react";

import { compactModalClass, Modal } from "@/components/ui/modal";
import { buttonClass } from "@/components/ui/styles";

/**
 * Acknowledge-only dialog for something the user must see before moving on — e.g. a
 * secret shown exactly once. Single action, no cancel: there is nothing to undo.
 */
export function NoticeDialog({
	open,
	title,
	description,
	actionLabel = "Concluir",
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	description?: string;
	actionLabel?: string;
	onClose: () => void;
	children?: ReactNode;
}) {
	const titleId = useId();

	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy={titleId}
			className={compactModalClass}
			size="form"
			showClose={false}
		>
			<h2 id={titleId}>{title}</h2>
			{description ? <p>{description}</p> : null}
			{children ? (
				<div className="flex min-h-0 flex-col gap-4 overflow-y-auto">{children}</div>
			) : null}
			<div className="flex justify-end gap-2">
				<button className={buttonClass({ size: "sm" })} type="button" onClick={onClose}>
					{actionLabel}
				</button>
			</div>
		</Modal>
	);
}
