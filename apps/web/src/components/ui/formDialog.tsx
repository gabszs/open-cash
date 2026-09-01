import type { FormEvent, ReactNode } from "react";

import { useId } from "react";

import { compactModalClass, Modal } from "@/components/ui/modal";
import { buttonClass } from "@/components/ui/styles";

/**
 * Creation flows open here instead of sitting expanded in the panel, mirroring
 * `ConfirmDialog`. Fields are uncontrolled and read from `FormData`; remounting
 * the form on every open clears whatever was typed before.
 */
export function FormDialog({
	open,
	title,
	description,
	submitLabel,
	pending = false,
	onSubmit,
	onCancel,
	children,
}: {
	open: boolean;
	title: string;
	description?: string;
	submitLabel: string;
	pending?: boolean;
	onSubmit: (values: FormData) => void;
	onCancel: () => void;
	children: ReactNode;
}) {
	const titleId = useId();

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSubmit(new FormData(event.currentTarget));
	}

	return (
		<Modal
			open={open}
			onClose={onCancel}
			labelledBy={titleId}
			className={compactModalClass}
			size="form"
			showClose={false}
		>
			<h2 id={titleId}>{title}</h2>
			{description ? <p>{description}</p> : null}
			<form
				key={String(open)}
				className="flex min-h-0 flex-col gap-4 overflow-y-auto"
				onSubmit={submit}
			>
				<div className="flex w-full flex-col gap-3">{children}</div>
				<div className="flex justify-end gap-2">
					<button
						className={buttonClass({ variant: "ghost", size: "sm" })}
						type="button"
						onClick={onCancel}
					>
						Cancelar
					</button>
					<button
						className={buttonClass({ size: "sm" })}
						type="submit"
						disabled={pending}
					>
						{pending ? "Salvando…" : submitLabel}
					</button>
				</div>
			</form>
		</Modal>
	);
}
