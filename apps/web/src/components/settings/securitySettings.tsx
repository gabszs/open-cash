import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Laptop, LoaderCircle, MapPin, Trash2 } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/authProvider";
import { SettingsSection } from "@/components/settings/settingsPrimitives";
import { TwoFactorSetupDialog } from "@/components/settings/twoFactorSetupDialog";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { DetailList } from "@/components/ui/detailList";
import {
	badgeClass,
	iconButtonClass,
	listActionsClass,
	listCardClass,
	listEmptyClass,
	listIconClass,
	listTriggerClass,
} from "@/components/ui/styles";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/authClient";
import { formatDateTime } from "@/lib/format";
import { describeDevice } from "@/lib/userAgent";

/** Base session plus the geolocation columns from better-auth-cloudflare and `impersonatedBy` from the admin plugin. */
interface SessionRow {
	id: string;
	token: string;
	userId: string;
	createdAt: Date | string;
	updatedAt: Date | string;
	expiresAt: Date | string;
	ipAddress?: string | null;
	userAgent?: string | null;
	impersonatedBy?: string | null;
	timezone?: string | null;
	city?: string | null;
	country?: string | null;
	region?: string | null;
	regionCode?: string | null;
	colo?: string | null;
	latitude?: string | null;
	longitude?: string | null;
}

/** The token is a live credential — never render it in full. */
const maskToken = (token: string) => `${token.slice(0, 8)}…`;

export function SecuritySettings() {
	const { session } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { toast } = useToast();
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [revoking, setRevoking] = useState<SessionRow | null>(null);
	const [revokePending, setRevokePending] = useState(false);
	const [settingUp2fa, setSettingUp2fa] = useState(false);
	const [disabling2fa, setDisabling2fa] = useState(false);
	const [disable2faPending, setDisable2faPending] = useState(false);
	const sessionQuery = useQuery({
		queryKey: ["auth", "sessions"],
		queryFn: async () => {
			const result = await authClient.listSessions();
			if (result.error) throw new Error(result.error.message ?? "Falha ao carregar sessões.");
			return result.data as unknown as SessionRow[];
		},
	});
	const twoFactorEnabled = Boolean(
		(session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled,
	);

	/** 2FA calls rotate the session, which leaves this list holding a deleted row. */
	async function refreshSessions() {
		await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
	}

	async function disableTwoFactor(password: string) {
		setDisable2faPending(true);
		const result = await authClient.twoFactor.disable({ password });
		setDisable2faPending(false);
		if (result.error) {
			toast.error(
				result.error.status === 429
					? "Muitas tentativas em sequência. Aguarde alguns segundos e tente de novo."
					: (result.error.message ?? "Falha ao desativar 2FA."),
			);
			return;
		}
		setDisabling2fa(false);
		toast.success("2FA desativado.");
		await refreshSessions();
	}

	/**
	 * `revokeSession` deletes the row but leaves the cookie behind, so revoking the
	 * session in use has to go through `signOut` to avoid a dangling logged-in shell.
	 */
	async function revoke(item: SessionRow) {
		setRevokePending(true);
		if (item.id === session?.session.id) {
			await authClient.signOut();
			await router.navigate({ to: "/auth/sign-in", search: {}, replace: true });
			await router.invalidate();
			return;
		}
		const result = await authClient.revokeSession({ token: item.token });
		setRevokePending(false);
		setRevoking(null);
		if (result.error) {
			toast.error(result.error.message ?? "Falha ao revogar sessão.");
			return;
		}
		toast.success("Sessão revogada.");
		await refreshSessions();
	}

	return (
		<>
			<SettingsSection
				title="Autenticação em duas etapas"
				description="Proteja a conta com TOTP e códigos de recuperação."
				action={
					<Switch
						checked={twoFactorEnabled}
						label="Autenticação em duas etapas"
						onChange={(next) => (next ? setSettingUp2fa(true) : setDisabling2fa(true))}
					/>
				}
			/>
			<hr className="-my-3 w-full border-0 border-t border-border" />
			<SettingsSection
				title="Sessões ativas"
				description="Toque em uma sessão para ver todos os campos. Localização e rede vêm dos metadados da Cloudflare."
			>
				{sessionQuery.isLoading ? (
					<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
						<LoaderCircle size={15} className="animate-spin" /> Carregando sessões…
					</div>
				) : null}
				{sessionQuery.isError ? (
					<p className={listEmptyClass}>Não foi possível carregar as sessões.</p>
				) : null}
				<div className={listCardClass}>
					{sessionQuery.data?.map((item) => {
						const current = item.id === session?.session.id;
						const expanded = expandedId === item.id;
						const location =
							[item.city, item.region, item.country].filter(Boolean).join(", ") ||
							"Localização indisponível";
						return (
							<article key={item.id}>
								<span className={listIconClass}>
									<Laptop size={15} />
								</span>
								<button
									className={listTriggerClass}
									type="button"
									aria-expanded={expanded}
									aria-label={`Detalhes da sessão ${describeDevice(item.userAgent)}`}
									onClick={() => setExpandedId(expanded ? null : item.id)}
								>
									<div>
										<strong>
											{describeDevice(item.userAgent)}
											{current ? (
												<i
													className={`${badgeClass} ml-2 border-[color-mix(in_oklab,var(--brand)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] text-brand`}
												>
													Atual
												</i>
											) : null}
										</strong>
										<small className="flex items-center gap-1">
											<MapPin className="shrink-0" size={11} />
											<span>
												{location} · CF {item.colo ?? "—"}
											</span>
										</small>
										<small>
											{item.ipAddress ?? "IP indisponível"} ·{" "}
											{item.timezone ?? "fuso indisponível"}
										</small>
									</div>
								</button>
								<div className={listActionsClass}>
									<button
										className={iconButtonClass({
											variant: "danger",
											size: "xs",
										})}
										type="button"
										onClick={() => setRevoking(item)}
										aria-label="Revogar sessão"
									>
										<Trash2 size={14} />
									</button>
								</div>
								{expanded ? (
									<DetailList
										items={[
											{ label: "ID", value: item.id },
											{ label: "Usuário", value: item.userId },
											{ label: "Token", value: maskToken(item.token) },
											{
												label: "Dispositivo",
												value: item.userAgent ?? "—",
											},
											{ label: "IP", value: item.ipAddress ?? "—" },
											{
												label: "Criada em",
												value: formatDateTime(item.createdAt),
											},
											{
												label: "Atualizada em",
												value: formatDateTime(item.updatedAt),
											},
											{
												label: "Expira em",
												value: formatDateTime(item.expiresAt),
											},
											{ label: "Fuso", value: item.timezone ?? "—" },
											{ label: "Cidade", value: item.city ?? "—" },
											{ label: "Região", value: item.region ?? "—" },
											{
												label: "Código da região",
												value: item.regionCode ?? "—",
											},
											{ label: "País", value: item.country ?? "—" },
											{ label: "Colo (CF)", value: item.colo ?? "—" },
											{ label: "Latitude", value: item.latitude ?? "—" },
											{ label: "Longitude", value: item.longitude ?? "—" },
											{
												label: "Impersonado por",
												value: item.impersonatedBy ?? "—",
											},
										]}
									/>
								) : null}
							</article>
						);
					})}
				</div>
			</SettingsSection>
			{/* Mounted only while open so each run restarts at the password step. Guarded by
			    `!twoFactorEnabled`: calling `enable` over a verified row would silently
			    invalidate the authenticator the user already registered. */}
			{settingUp2fa && !twoFactorEnabled ? (
				<TwoFactorSetupDialog
					onClose={() => setSettingUp2fa(false)}
					onCompleted={refreshSessions}
				/>
			) : null}
			<ConfirmDialog
				open={disabling2fa}
				title="Desativar 2FA"
				description="A conta volta a depender apenas da senha. Confirme com sua senha atual."
				confirmLabel="Desativar"
				pending={disable2faPending}
				requirePassword
				onConfirm={disableTwoFactor}
				onCancel={() => setDisabling2fa(false)}
			/>
			<ConfirmDialog
				open={Boolean(revoking)}
				title="Revogar sessão"
				description={
					revoking?.id === session?.session.id
						? "Esta é a sessão em uso. Revogá-la encerra o acesso neste dispositivo e você será levado para a tela de login."
						: "O dispositivo perderá o acesso imediatamente e precisará entrar novamente."
				}
				confirmLabel="Revogar"
				pending={revokePending}
				onConfirm={() => {
					if (revoking) void revoke(revoking);
				}}
				onCancel={() => setRevoking(null)}
			/>
		</>
	);
}
