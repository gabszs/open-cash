import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/chat/copyButton";
import { SettingsSection } from "@/components/settings/settingsPrimitives";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { DetailList } from "@/components/ui/detailList";
import { FormDialog } from "@/components/ui/formDialog";
import { InfoHint } from "@/components/ui/infoHint";
import { NoticeDialog } from "@/components/ui/noticeDialog";
import {
	buttonClass,
	fieldClass,
	fieldLabelClass,
	iconButtonClass,
	inputClass,
	listActionsClass,
	listCardClass,
	listEmptyClass,
	listIconClass,
	listRowEditClass,
	listTriggerClass,
	secretBlockClass,
} from "@/components/ui/styles";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/authClient";
import {
	dateInputOffsetFromToday,
	formatDateTime,
	parseDateInputValue,
	toDateInputValue,
} from "@/lib/format";

interface ApiKeyItem {
	id: string;
	name?: string | null;
	start?: string | null;
	prefix?: string | null;
	referenceId: string;
	enabled?: boolean | null;
	requestCount?: number | null;
	lastRequest?: Date | string | null;
	expiresAt?: Date | string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
}

const DAY_SECONDS = 86_400;
/** The server rejects anything under a full day and over 365 days. */
const MIN_EXPIRY_DAYS = 2;
const MAX_EXPIRY_DAYS = 365;

/**
 * `expiresIn` is in seconds and validated as `expiresIn / 86400 >= 1`. A date input
 * yields local midnight, so "tomorrow" is always short of a full day except exactly
 * at midnight — hence the +2 floor on the input and the clamp here.
 */
function toExpiresIn(value: string) {
	const target = parseDateInputValue(value);
	if (!target) return null;
	return Math.max(DAY_SECONDS, Math.floor((target.getTime() - Date.now()) / 1000));
}

export function ApiKeySettings() {
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const [creating, setCreating] = useState(false);
	const [createPending, setCreatePending] = useState(false);
	const [newKey, setNewKey] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState("");
	const [draftExpiry, setDraftExpiry] = useState("");
	const [savingId, setSavingId] = useState<string | null>(null);
	const [removing, setRemoving] = useState<ApiKeyItem | null>(null);
	const [removePending, setRemovePending] = useState(false);
	const keysQuery = useQuery({
		queryKey: ["auth", "api-keys"],
		queryFn: async () => {
			const result = await authClient.apiKey.list();
			if (result.error) {
				throw new Error(result.error.message ?? "Falha ao carregar API keys.");
			}
			return (result.data?.apiKeys ?? []) as unknown as ApiKeyItem[];
		},
	});

	async function refresh() {
		await queryClient.invalidateQueries({ queryKey: ["auth", "api-keys"] });
	}

	async function createKey(values: FormData) {
		const name = String(values.get("name") ?? "").trim();
		const expiry = String(values.get("expiresAt") ?? "");
		setCreatePending(true);
		// `permissions` is server-only in the api-key plugin; defaults are applied there.
		const result = await authClient.apiKey.create({
			name,
			...(expiry ? { expiresIn: toExpiresIn(expiry) } : {}),
		});
		setCreatePending(false);
		if (result.error) return toast.error(result.error.message ?? "Falha ao criar a chave.");
		// Shown once by the API: the dialog stays open on a dedicated step so it cannot be lost.
		setNewKey(result.data?.key ?? "");
		setCreating(false);
		await refresh();
	}

	function startEditing(key: ApiKeyItem) {
		setEditingId(key.id);
		setExpandedId(null);
		setDraftName(key.name ?? "");
		setDraftExpiry(toDateInputValue(key.expiresAt));
	}

	async function saveKey(key: ApiKeyItem) {
		const name = draftName.trim();
		const currentExpiry = toDateInputValue(key.expiresAt);
		const nameChanged = name !== (key.name ?? "");
		const expiryChanged = draftExpiry !== currentExpiry;
		// `update` answers NO_VALUES_TO_UPDATE when the payload changes nothing.
		if (!nameChanged && !expiryChanged) {
			setEditingId(null);
			return;
		}

		setSavingId(key.id);
		const result = await authClient.apiKey.update({
			keyId: key.id,
			...(nameChanged ? { name } : {}),
			...(expiryChanged ? { expiresIn: draftExpiry ? toExpiresIn(draftExpiry) : null } : {}),
		});
		setSavingId(null);
		if (result.error) return toast.error(result.error.message ?? "Falha ao salvar a chave.");
		setEditingId(null);
		toast.success("Chave atualizada.");
		await refresh();
	}

	async function toggleKey(key: ApiKeyItem, enabled: boolean) {
		const result = await authClient.apiKey.update({ enabled, keyId: key.id });
		if (result.error) {
			toast.error(result.error.message ?? "Falha ao alterar a chave.");
			return;
		}
		toast.success(enabled ? "Chave ativada." : "Chave desativada.");
		await refresh();
	}

	async function deleteKey(key: ApiKeyItem) {
		setRemovePending(true);
		const result = await authClient.apiKey.delete({ keyId: key.id });
		setRemovePending(false);
		setRemoving(null);
		if (result.error) {
			toast.error(result.error.message ?? "Falha ao remover a chave.");
			return;
		}
		toast.success("Chave removida.");
		await refresh();
	}

	return (
		<SettingsSection
			description={
				<>
					Credenciais pessoais para clientes MCP e integrações externas.
					<InfoHint icon={<KeyRound size={16} />}>
						Envie a chave em <code>x-api-key</code> ou em{" "}
						<code>Authorization: Bearer</code>. O servidor resolve sempre o mesmo
						usuário proprietário.
					</InfoHint>
				</>
			}
			action={
				<button
					className={buttonClass({ size: "sm" })}
					type="button"
					onClick={() => setCreating(true)}
				>
					<Plus size={14} /> Nova chave
				</button>
			}
		>
			<div className={listCardClass}>
				{keysQuery.data?.length ? (
					keysQuery.data.map((key) => {
						const editing = editingId === key.id;
						const expanded = expandedId === key.id;
						const enabled = key.enabled !== false;
						return (
							<article key={key.id}>
								<span className={listIconClass}>
									<KeyRound size={15} />
								</span>
								{editing ? (
									<div className={listRowEditClass}>
										<input
											className={`${inputClass} h-[30px] text-[13px]`}
											value={draftName}
											onChange={(event) => setDraftName(event.target.value)}
											aria-label="Nome da chave"
											maxLength={32}
											required
										/>
										<input
											className={`${inputClass} h-[30px] text-[13px]`}
											type="date"
											value={draftExpiry}
											onChange={(event) => setDraftExpiry(event.target.value)}
											aria-label="Expira em"
											min={dateInputOffsetFromToday(MIN_EXPIRY_DAYS)}
											max={dateInputOffsetFromToday(MAX_EXPIRY_DAYS)}
										/>
									</div>
								) : (
									<button
										className={listTriggerClass}
										type="button"
										aria-expanded={expanded}
										aria-label={`Detalhes de ${key.name ?? "chave sem nome"}`}
										onClick={() => setExpandedId(expanded ? null : key.id)}
									>
										<div>
											<strong>{key.name ?? "Sem nome"}</strong>
											<small>
												{key.prefix}
												{key.start}•••• · criada em{" "}
												{formatDateTime(key.createdAt)}
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
												onClick={() => void saveKey(key)}
												disabled={savingId === key.id}
											>
												{savingId === key.id ? "Salvando…" : "Salvar"}
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
											<Switch
												checked={enabled}
												label={`Chave ${key.name ?? "sem nome"} ativa`}
												onChange={(next) => void toggleKey(key, next)}
											/>
											<button
												key="edit"
												className={iconButtonClass({ size: "xs" })}
												type="button"
												onClick={() => startEditing(key)}
												aria-label="Editar chave"
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
												onClick={() => setRemoving(key)}
												aria-label="Excluir chave"
											>
												<Trash2 size={14} />
											</button>
										</>
									)}
								</div>
								{expanded && !editing ? (
									<DetailList
										items={[
											{ label: "ID", value: key.id },
											{ label: "Reference ID", value: key.referenceId },
											{
												label: "Requisições",
												value: key.requestCount ?? 0,
											},
											{
												label: "Última requisição",
												value: formatDateTime(key.lastRequest, "Nunca"),
											},
											{
												label: "Expira em",
												value: formatDateTime(
													key.expiresAt,
													"Sem expiração",
												),
											},
											{
												label: "Criada em",
												value: formatDateTime(key.createdAt),
											},
											{
												label: "Atualizada em",
												value: formatDateTime(key.updatedAt),
											},
										]}
									/>
								) : null}
							</article>
						);
					})
				) : (
					<p className={listEmptyClass}>Nenhuma chave criada até agora.</p>
				)}
			</div>
			<FormDialog
				open={creating}
				title="Nova chave API"
				description="A chave é exibida uma única vez, logo após a criação."
				submitLabel="Criar chave"
				pending={createPending}
				onSubmit={(values) => void createKey(values)}
				onCancel={() => setCreating(false)}
			>
				<label className={fieldClass}>
					<span className={fieldLabelClass}>Nome</span>
					<input
						className={inputClass}
						name="name"
						defaultValue="Integração Finance MCP"
						maxLength={32}
						required
					/>
					<small className="text-xs text-muted-foreground">Até 32 caracteres.</small>
				</label>
				<label className={fieldClass}>
					<span className={fieldLabelClass}>Expira em</span>
					<input
						className={inputClass}
						name="expiresAt"
						type="date"
						min={dateInputOffsetFromToday(MIN_EXPIRY_DAYS)}
						max={dateInputOffsetFromToday(MAX_EXPIRY_DAYS)}
					/>
					<small>Deixe vazio para não expirar. Máximo de 365 dias.</small>
				</label>
			</FormDialog>
			<NoticeDialog
				open={Boolean(newKey)}
				title="Chave criada"
				description="Copie a chave agora: ela não será exibida novamente."
				onClose={() => setNewKey("")}
			>
				<div className={`${secretBlockClass} grid-cols-[minmax(0,1fr)_auto] items-start`}>
					<code>{newKey}</code>
					<CopyButton value={newKey} label="Copiar chave API" />
				</div>
			</NoticeDialog>
			<ConfirmDialog
				open={Boolean(removing)}
				title="Excluir chave"
				description="Integrações que usam esta chave perdem o acesso imediatamente."
				confirmLabel="Excluir"
				pending={removePending}
				onConfirm={() => {
					if (removing) void deleteKey(removing);
				}}
				onCancel={() => setRemoving(null)}
			/>
		</SettingsSection>
	);
}
