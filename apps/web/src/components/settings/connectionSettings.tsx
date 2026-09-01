import type { Connection, ConnectionUpdate } from "@server/features/connections/schemas";

import { Check, Landmark, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import { useConnection } from "@/components/connectionProvider";
import { SettingsSection } from "@/components/settings/settingsPrimitives";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { DetailList } from "@/components/ui/detailList";
import { FormDialog } from "@/components/ui/formDialog";
import { InfoHint } from "@/components/ui/infoHint";
import {
	badgeClass,
	buttonClass,
	fieldClass,
	fieldGridClass,
	fieldLabelClass,
	iconButtonClass,
	inputClass,
	listActionsClass,
	listCardClass,
	listEmptyClass,
	listIconClass,
	listRowEditClass,
	listTriggerClass,
} from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import {
	useCreateFinanceConnection,
	useDeleteFinanceConnection,
	useFinanceConnections,
	useUpdateFinanceConnection,
} from "@/hooks/useFinanceConnections";
import { formatDateTime } from "@/lib/format";

const parseItemIds = (value: string) =>
	value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

export function ConnectionSettings() {
	const { toast } = useToast();
	const { connectionId, reloadConnection } = useConnection();
	const [creating, setCreating] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState("");
	const [draftClientId, setDraftClientId] = useState("");
	const [draftSecret, setDraftSecret] = useState("");
	const [draftItemIds, setDraftItemIds] = useState("");
	const [savingId, setSavingId] = useState<string | null>(null);
	const [removing, setRemoving] = useState<Connection | null>(null);
	const [removePending, setRemovePending] = useState(false);
	const connections = useFinanceConnections();
	const create = useCreateFinanceConnection();
	const update = useUpdateFinanceConnection();
	const removeConnection = useDeleteFinanceConnection();

	function submit(values: FormData) {
		create.mutate(
			{
				clientId: String(values.get("clientId")),
				clientSecret: String(values.get("clientSecret")),
				itemIds: parseItemIds(String(values.get("itemIds"))),
				name: String(values.get("name")),
			},
			{
				onSuccess: () => {
					setCreating(false);
					toast.success(
						"Provedor conectado. A credencial foi enviada ao cofre do servidor.",
					);
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function startEditing(connection: Connection) {
		setEditingId(connection.id);
		setExpandedId(null);
		setDraftName(connection.name);
		setDraftClientId(connection.clientId);
		setDraftSecret("");
		setDraftItemIds(connection.itemIds.join(", "));
	}

	const draftItems = parseItemIds(draftItemIds);
	/** The table has a unique (userId, name) index and the API has no 409 for it. */
	const nameTaken = connections.data?.some(
		(item) => item.id !== editingId && item.name === draftName.trim(),
	);
	const editInvalid =
		!draftName.trim() || !draftClientId.trim() || !draftItems.length || nameTaken;

	async function save(connection: Connection) {
		const name = draftName.trim();
		const clientId = draftClientId.trim();
		const itemsChanged = draftItems.join(",") !== connection.itemIds.join(",");
		const patch: ConnectionUpdate = {
			...(name === connection.name ? {} : { name }),
			...(clientId === connection.clientId ? {} : { clientId }),
			...(itemsChanged ? { itemIds: draftItems } : {}),
			// The schema is `min(1)`: an untouched field must be omitted, not sent empty.
			...(draftSecret ? { clientSecret: draftSecret } : {}),
		};
		if (!Object.keys(patch).length) {
			setEditingId(null);
			return;
		}

		setSavingId(connection.id);
		try {
			await update.mutateAsync({ connectionId: connection.id, input: patch });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Falha ao salvar a conexão.");
			return;
		} finally {
			setSavingId(null);
		}
		setEditingId(null);
		toast.success("Conexão atualizada.");
	}

	async function remove(connection: Connection) {
		setRemovePending(true);
		try {
			await removeConnection.mutateAsync(connection.id);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Falha ao remover a conexão.");
			return;
		} finally {
			setRemovePending(false);
			setRemoving(null);
		}
		toast.success("Conexão removida.");
		// `ON DELETE SET NULL` already cleared the server's selection; the provider is
		// still holding the dead id, so re-read settings before the screens requery.
		if (connectionId === connection.id) await reloadConnection();
	}

	return (
		<SettingsSection
			title={
				<>
					Conexões cadastradas
					<InfoHint icon={<ShieldCheck size={16} />}>
						Credenciais pessoais são criptografadas no backend e nunca retornam ao
						navegador.
					</InfoHint>
				</>
			}
			action={
				<button
					className={buttonClass({ size: "sm" })}
					type="button"
					onClick={() => setCreating(true)}
				>
					<Plus size={14} /> Nova conexão
				</button>
			}
		>
			<div className={listCardClass}>
				{connections.data?.length ? (
					connections.data.map((connection) => {
						const editing = editingId === connection.id;
						const expanded = expandedId === connection.id;
						return (
							<article key={connection.id}>
								<span className={listIconClass}>
									<Landmark size={15} />
								</span>
								{editing ? (
									<div className={listRowEditClass}>
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
											value={draftClientId}
											onChange={(event) =>
												setDraftClientId(event.target.value)
											}
											aria-label="Client ID"
											placeholder="Client ID"
											autoComplete="off"
											required
										/>
										<input
											className={`${inputClass} h-[30px] text-[13px]`}
											type="password"
											value={draftSecret}
											onChange={(event) => setDraftSecret(event.target.value)}
											aria-label="Client secret"
											placeholder="Client secret (vazio = manter)"
											autoComplete="off"
										/>
										<input
											className={`${inputClass} h-[30px] text-[13px]`}
											value={draftItemIds}
											onChange={(event) =>
												setDraftItemIds(event.target.value)
											}
											aria-label="Item IDs"
											placeholder="item_1, item_2"
											required
										/>
										{nameTaken ? (
											<small className="text-xs text-destructive">
												Já existe uma conexão com esse nome.
											</small>
										) : null}
									</div>
								) : (
									<button
										className={listTriggerClass}
										type="button"
										aria-expanded={expanded}
										aria-label={`Detalhes de ${connection.name}`}
										onClick={() =>
											setExpandedId(expanded ? null : connection.id)
										}
									>
										<div>
											<strong>{connection.name}</strong>
											<small>
												{connection.itemIds.length} itens · Pluggy
											</small>
										</div>
									</button>
								)}
								<div className={listActionsClass}>
									{editing ? (
										<>
											<button
												key="save"
												className={buttonClass({ size: "sm" })}
												type="button"
												onClick={() => void save(connection)}
												disabled={editInvalid || savingId === connection.id}
											>
												{savingId === connection.id
													? "Salvando…"
													: "Salvar"}
											</button>
											<button
												key="cancel"
												className={buttonClass({
													variant: "ghost",
													size: "sm",
												})}
												type="button"
												onClick={() => setEditingId(null)}
											>
												Cancelar
											</button>
										</>
									) : (
										<>
											<i
												className={`${badgeClass} border-[color-mix(in_oklab,var(--brand)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] text-brand`}
											>
												<Check size={11} /> Ativa
											</i>
											<button
												key="edit"
												className={iconButtonClass({ size: "xs" })}
												type="button"
												onClick={() => startEditing(connection)}
												aria-label={`Editar ${connection.name}`}
											>
												<Pencil size={14} />
											</button>
											<button
												key="delete"
												className={iconButtonClass({
													variant: "danger",
													size: "xs",
												})}
												type="button"
												onClick={() => setRemoving(connection)}
												aria-label={`Remover ${connection.name}`}
											>
												<Trash2 size={14} />
											</button>
										</>
									)}
								</div>
								{expanded && !editing ? (
									<DetailList
										items={[
											{ label: "ID", value: connection.id },
											{ label: "Provedor", value: connection.provider },
											{ label: "Client ID", value: connection.clientId },
											{
												label: "Item IDs",
												value: connection.itemIds.join(", ") || "—",
											},
											{
												label: "Criada em",
												value: formatDateTime(connection.createdAt),
											},
											{
												label: "Atualizada em",
												value: formatDateTime(connection.updatedAt),
											},
										]}
									/>
								) : null}
							</article>
						);
					})
				) : (
					<p className={listEmptyClass}>Nenhum provedor conectado.</p>
				)}
			</div>
			<FormDialog
				open={creating}
				title="Nova conexão"
				description="O client secret é enviado direto ao cofre do servidor e nunca volta ao navegador."
				submitLabel="Salvar conexão"
				pending={create.isPending}
				onSubmit={submit}
				onCancel={() => setCreating(false)}
			>
				<div className={fieldGridClass}>
					<label className={fieldClass}>
						<span className={fieldLabelClass}>Nome</span>
						<input
							className={inputClass}
							name="name"
							placeholder="Pluggy pessoal"
							required
						/>
					</label>
					<label className={fieldClass}>
						<span className={fieldLabelClass}>Client ID</span>
						<input className={inputClass} name="clientId" autoComplete="off" required />
					</label>
				</div>
				<label className={fieldClass}>
					<span className={fieldLabelClass}>Client secret</span>
					<input
						className={inputClass}
						name="clientSecret"
						type="password"
						autoComplete="new-password"
						required
					/>
				</label>
				<label className={fieldClass}>
					<span className={fieldLabelClass}>Item IDs</span>
					<input
						className={inputClass}
						name="itemIds"
						placeholder="item_1, item_2"
						required
					/>
					<small>Separe múltiplos itens por vírgula.</small>
				</label>
			</FormDialog>
			<ConfirmDialog
				open={Boolean(removing)}
				title="Remover conexão"
				description="As contas desse provedor deixam de alimentar os painéis e o agente."
				confirmLabel="Remover"
				pending={removePending}
				onConfirm={() => {
					if (removing) void remove(removing);
				}}
				onCancel={() => setRemoving(null)}
			/>
		</SettingsSection>
	);
}
