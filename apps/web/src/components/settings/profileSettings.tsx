import type { ChangeEvent } from "react";

import { useRouter } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/authProvider";
import { SettingsSection } from "@/components/settings/settingsPrimitives";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import {
	buttonClass,
	iconButtonClass,
	inputClass,
	settingsActionsClass,
} from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/authClient";
import { formatDate } from "@/lib/format";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function isExternalUrl(image: string) {
	return image.startsWith("http://") || image.startsWith("https://");
}

/**
 * `POST /files/upload-raw` echoes back the id the plugin generated, but Better Auth
 * discards a caller-supplied id on `adapter.create` unless `forceAllowId` is passed
 * — which the plugin does not do — so the persisted row carries a different id and
 * `/files/download` 404s on the echoed one. `r2Key` survives intact, so the real id
 * is looked up from the listing, which reads straight from the table.
 */
async function resolveFileId(r2Key: string) {
	const listed = await authClient.files.list();
	if (listed.error) return;
	const files = (listed.data as { files?: { id: string; r2Key: string }[] } | null)?.files ?? [];
	return files.find((item) => item.r2Key === r2Key)?.id;
}

export function ProfileSettings() {
	const { session } = useAuth();
	const router = useRouter();
	const { toast } = useToast();
	const [editing, setEditing] = useState(false);
	const [draftName, setDraftName] = useState("");
	const [draftImage, setDraftImage] = useState("");
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const user = session?.user;

	function startEditing() {
		setDraftName(user?.name ?? "");
		setDraftImage(user?.image ?? "");
		setEditing(true);
	}

	async function saveProfile() {
		setSaving(true);
		const result = await authClient.updateUser({
			image: draftImage.trim() || null,
			name: draftName.trim(),
		});
		setSaving(false);
		if (result.error) {
			toast.error(result.error.message ?? "Não foi possível atualizar o perfil.");
			return;
		}
		setEditing(false);
		toast.success("Perfil atualizado.");
	}

	/** Uploads to R2 through the Cloudflare plugin, then points `image` at the new file id. */
	async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
			toast.error("Formato não suportado. Envie JPG, PNG, WebP ou GIF.");
			return;
		}
		if (file.size > MAX_PHOTO_BYTES) {
			toast.error("A foto deve ter no máximo 2 MB.");
			return;
		}

		setUploading(true);
		const uploaded = await authClient.uploadFile(file);
		if (uploaded.error) {
			setUploading(false);
			toast.error(uploaded.error.message ?? "Falha ao enviar a foto.");
			return;
		}

		const r2Key = (uploaded.data as { data?: { r2Key?: string } } | null)?.data?.r2Key;
		const fileId = r2Key ? await resolveFileId(r2Key) : undefined;
		if (!fileId) {
			setUploading(false);
			toast.error("Falha ao enviar a foto.");
			return;
		}

		const previous = user?.image;
		const result = await authClient.updateUser({ image: fileId });
		setUploading(false);
		if (result.error) {
			toast.error(result.error.message ?? "Falha ao salvar a foto.");
			return;
		}
		if (editing) setDraftImage(fileId);
		toast.success("Foto atualizada.");

		// Best effort: drop the replaced upload so R2 does not accumulate old avatars.
		if (previous && !isExternalUrl(previous)) {
			await authClient.files.delete({ fileId: previous }).catch(() => null);
		}
	}

	async function deleteAccount(password: string) {
		setDeleting(true);
		const result = await authClient.deleteUser({ password });
		setDeleting(false);
		if (result.error) {
			toast.error(
				result.error.status === 404
					? "A exclusão de conta está desabilitada neste servidor."
					: (result.error.message ?? "Não foi possível excluir a conta."),
			);
			return;
		}
		setConfirmingDelete(false);
		await router.navigate({ to: "/auth/sign-in", search: {}, replace: true });
		await router.invalidate();
	}

	return (
		<>
			<div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-lg border border-border bg-card p-3.5">
				<label className="group/avatar relative grid cursor-pointer rounded-lg has-[input:disabled]:pointer-events-none">
					<Avatar image={user?.image} name={user?.name} size="large" />
					<span className="absolute inset-0 grid place-items-center rounded-lg bg-black/55 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100 group-has-[input:disabled]/avatar:opacity-100">
						{uploading ? "Enviando…" : "Alterar"}
					</span>
					<input
						className="sr-only"
						type="file"
						accept={ALLOWED_PHOTO_TYPES.join(",")}
						aria-label="Alterar foto de perfil"
						disabled={uploading}
						onChange={changePhoto}
					/>
				</label>
				{editing ? (
					<form
						className="grid min-w-0 gap-1"
						onSubmit={(event) => {
							event.preventDefault();
							void saveProfile();
						}}
					>
						<input
							className={`${inputClass} h-[30px] text-[13px]`}
							value={draftName}
							onChange={(event) => setDraftName(event.target.value)}
							aria-label="Nome"
							placeholder="Nome"
							required
						/>
						<input
							className={`${inputClass} h-[30px] text-[13px]`}
							value={draftImage}
							onChange={(event) => setDraftImage(event.target.value)}
							aria-label="Foto"
							placeholder="https://… ou envie um arquivo"
						/>
						<small className="truncate text-xs text-muted-foreground">
							{user?.email}
						</small>
					</form>
				) : (
					<div className="grid min-w-0 gap-1">
						<strong className="truncate text-sm font-medium">{user?.name}</strong>
						<small className="truncate text-xs text-muted-foreground">
							{user?.email}
						</small>
					</div>
				)}
				{/* Distinct keys keep React from reusing the same <button> node across
				    modes: mutating the clicked node into a submit button makes the
				    browser run the submit default action for that very click. */}
				<div className="flex flex-col gap-1.5">
					{editing ? (
						<>
							<button
								key="save"
								className={buttonClass({ size: "sm" })}
								type="button"
								onClick={() => void saveProfile()}
								disabled={saving}
							>
								{saving ? "Salvando…" : "Salvar"}
							</button>
							<button
								key="cancel"
								className={buttonClass({ variant: "ghost", size: "sm" })}
								type="button"
								onClick={() => setEditing(false)}
							>
								Cancelar
							</button>
						</>
					) : (
						<button
							key="edit"
							className={iconButtonClass({ variant: "outline" })}
							type="button"
							onClick={startEditing}
							aria-label="Editar perfil"
						>
							<Pencil size={14} />
						</button>
					)}
				</div>
			</div>
			<hr className="-my-4.5 w-full border-0 border-t border-border" />
			<dl className="grid w-full gap-2">
				<div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2.5 text-xs">
					<dt className="text-muted-foreground">ID</dt>
					<dd className="m-0 truncate">{user?.id}</dd>
				</div>
				<div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2.5 text-xs">
					<dt className="text-muted-foreground">Membro desde</dt>
					<dd className="m-0 truncate">{formatDate(user?.createdAt)}</dd>
				</div>
			</dl>
			<hr className="-my-3 w-full border-0 border-t border-border" />
			<SettingsSection
				title="Excluir conta"
				description="Remove permanentemente a conta, os dados financeiros e os arquivos enviados."
			>
				<div className={settingsActionsClass}>
					<button
						className={buttonClass({ variant: "danger", size: "sm" })}
						type="button"
						onClick={() => setConfirmingDelete(true)}
					>
						Excluir conta
					</button>
				</div>
			</SettingsSection>
			<ConfirmDialog
				open={confirmingDelete}
				title="Excluir conta"
				description="Esta ação é permanente e não pode ser desfeita. Confirme com sua senha atual para continuar."
				confirmLabel="Excluir conta"
				pending={deleting}
				requirePassword
				onConfirm={deleteAccount}
				onCancel={() => setConfirmingDelete(false)}
			/>
		</>
	);
}
