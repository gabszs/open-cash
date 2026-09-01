import type { FormEvent } from "react";

import { useId } from "react";

import { compactModalClass, Modal } from "@/components/ui/modal";
import { buttonClass, inputClass } from "@/components/ui/styles";

/**
 * Permission gate for destructive actions. Stacks safely over another modal: the
 * outer `<dialog>` is inert while this one is open, and `Modal` filters backdrop
 * clicks by target so only the topmost dialog reacts.
 */
export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	pending = false,
	requirePassword = false,
	onConfirm,
	onCancel,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	pending?: boolean;
	requirePassword?: boolean;
	onConfirm: (password: string) => void;
	onCancel: () => void;
}) {
	const titleId = useId();

	function confirm(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const values = new FormData(event.currentTarget);
		onConfirm(String(values.get("password") ?? ""));
	}

	return (
		<Modal
			open={open}
			onClose={onCancel}
			labelledBy={titleId}
			className={compactModalClass}
			size="compact"
			showClose={false}
		>
			<h2 id={titleId}>{title}</h2>
			<p>{description}</p>
			{/* Remounting on open clears a previously typed password without an effect. */}
			<form key={String(open)} className="flex w-full flex-col gap-3" onSubmit={confirm}>
				{requirePassword ? (
					<label className="grid gap-2 text-sm">
						<span className="flex items-center gap-1.5 text-foreground">
							Senha atual
						</span>
						<input
							className={inputClass}
							name="password"
							type="password"
							autoComplete="current-password"
							required
						/>
					</label>
				) : null}
				<div className="flex justify-end gap-2">
					<button
						className={buttonClass({ variant: "ghost", size: "sm" })}
						type="button"
						onClick={onCancel}
					>
						Cancelar
					</button>
					<button
						className={buttonClass({ variant: "danger", size: "sm" })}
						type="submit"
						disabled={pending}
					>
						{pending ? "Processando…" : confirmLabel}
					</button>
				</div>
			</form>
		</Modal>
	);
}
