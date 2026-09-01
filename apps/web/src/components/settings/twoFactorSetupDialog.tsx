import type { FormEvent } from "react";

import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useId, useState } from "react";

import { compactModalClass, Modal } from "@/components/ui/modal";
import {
	buttonClass,
	fieldClass,
	fieldLabelClass,
	inputClass,
	secretBlockClass,
	settingsActionsClass,
} from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/authClient";

interface Setup {
	totpURI: string;
	backupCodes: string[];
}

/**
 * Two steps, because Better Auth splits the flow: `enable` only stores an unverified
 * secret and hands back the TOTP URI, and `verifyTotp` is what actually turns 2FA on.
 * Abandoning between the two is safe — the next `enable` replaces the unverified row.
 *
 * Mounted only while open, so every run starts from a clean step.
 */
export function TwoFactorSetupDialog({
	onClose,
	onCompleted,
}: {
	onClose: () => void;
	onCompleted: () => Promise<void> | void;
}) {
	const titleId = useId();
	const { toast } = useToast();
	const [setup, setSetup] = useState<Setup | null>(null);
	const [pending, setPending] = useState(false);

	function reportError(error: { message?: string; status: number }, fallback: string) {
		toast.error(
			error.status === 429
				? "Muitas tentativas em sequência. Aguarde alguns segundos e tente de novo."
				: (error.message ?? fallback),
		);
	}

	async function requestSecret(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const password = String(new FormData(event.currentTarget).get("password") ?? "");
		setPending(true);
		const result = await authClient.twoFactor.enable({ password });
		setPending(false);
		if (result.error) return reportError(result.error, "Falha ao iniciar a configuração.");
		setSetup(result.data ?? null);
	}

	async function confirmCode(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const code = String(new FormData(event.currentTarget).get("code") ?? "");
		setPending(true);
		// `trustDevice` is deliberately omitted: it only takes effect during the
		// sign-in challenge, so it would promise something that does not happen here.
		const result = await authClient.twoFactor.verifyTotp({ code });
		setPending(false);
		if (result.error) return reportError(result.error, "Código inválido.");
		toast.success("2FA ativado. Guarde os códigos de recuperação em local seguro.");
		await onCompleted();
		onClose();
	}

	return (
		<Modal
			open
			onClose={onClose}
			labelledBy={titleId}
			className={compactModalClass}
			size="compact"
			showClose={false}
		>
			<h2 id={titleId}>Configurar 2FA</h2>
			{setup ? (
				<>
					<p>
						Escaneie o QR code no seu aplicativo autenticador e informe o código de 6
						dígitos para concluir.
					</p>
					<form
						className="flex min-h-0 flex-col gap-4 overflow-y-auto"
						onSubmit={confirmCode}
					>
						<div className="grid place-items-center rounded-md border border-border bg-white p-3">
							<QRCodeSVG value={setup.totpURI} size={168} />
						</div>
						<div className={secretBlockClass}>
							<strong>Não consegue escanear? Use esta chave</strong>
							<code>{setup.totpURI}</code>
							<button
								className={buttonClass({ variant: "secondary", size: "sm" })}
								type="button"
								onClick={() => navigator.clipboard.writeText(setup.totpURI)}
							>
								<Copy size={14} /> Copiar
							</button>
						</div>
						<div className={secretBlockClass}>
							<strong>Códigos de recuperação</strong>
							<div className="grid grid-cols-2 gap-1 max-mobile:grid-cols-1 [&_code]:rounded-sm [&_code]:border [&_code]:border-border [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-1.25">
								{setup.backupCodes.map((code) => (
									<code key={code}>{code}</code>
								))}
							</div>
						</div>
						<label className={fieldClass}>
							<span className={fieldLabelClass}>Código de 6 dígitos</span>
							<input
								className={inputClass}
								name="code"
								inputMode="numeric"
								autoComplete="one-time-code"
								placeholder="000000"
								required
							/>
						</label>
						<div className={settingsActionsClass}>
							<button
								className={buttonClass({ variant: "ghost", size: "sm" })}
								type="button"
								onClick={onClose}
							>
								Cancelar
							</button>
							<button
								className={buttonClass({ size: "sm" })}
								type="submit"
								disabled={pending}
							>
								{pending ? "Verificando…" : "Ativar 2FA"}
							</button>
						</div>
					</form>
				</>
			) : (
				<>
					<p>Confirme sua senha para gerar a chave do aplicativo autenticador.</p>
					<form
						className="flex min-h-0 flex-col gap-4 overflow-y-auto"
						onSubmit={requestSecret}
					>
						<label className={fieldClass}>
							<span className={fieldLabelClass}>Senha atual</span>
							<input
								className={inputClass}
								name="password"
								type="password"
								autoComplete="current-password"
								required
							/>
						</label>
						<div className={settingsActionsClass}>
							<button
								className={buttonClass({ variant: "ghost", size: "sm" })}
								type="button"
								onClick={onClose}
							>
								Cancelar
							</button>
							<button
								className={buttonClass({ size: "sm" })}
								type="submit"
								disabled={pending}
							>
								{pending ? "Gerando…" : "Continuar"}
							</button>
						</div>
					</form>
				</>
			)}
		</Modal>
	);
}
