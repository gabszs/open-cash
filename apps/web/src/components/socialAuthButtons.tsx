import { Github } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/authClient";

export type SocialProvider = "github" | "google";

const providerLabels: Record<SocialProvider, string> = {
	github: "GitHub",
	google: "Google",
};

export function isSocialProvider(value: unknown): value is SocialProvider {
	return value === "github" || value === "google";
}

export function socialAuthError(provider: SocialProvider, code?: string) {
	const label = providerLabels[provider];
	if (code === "PROVIDER_NOT_FOUND" || code === "oauth_provider_not_found") {
		return `O login com ${label} não está configurado neste ambiente.`;
	}
	if (code === "access_denied") {
		return `A autorização pelo ${label} foi cancelada.`;
	}
	if (code === "email_not_found") {
		return `O ${label} não forneceu um e-mail para concluir o acesso.`;
	}
	if (code === "account_already_linked_to_different_user") {
		return `Esta conta do ${label} já está vinculada a outro usuário.`;
	}
	return `Não foi possível continuar com ${label}. Tente novamente.`;
}

function GoogleIcon() {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5">
			<path
				fill="#4285f4"
				d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"
			/>
			<path
				fill="#34a853"
				d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.4-4H3.3v2.6A10 10 0 0 0 12 22Z"
			/>
			<path fill="#fbbc05" d="M6.6 14a6 6 0 0 1 0-4V7.4H3.3a10 10 0 0 0 0 9.2L6.6 14Z" />
			<path
				fill="#ea4335"
				d="M12 5.9c1.6 0 3 .5 4.2 1.6l3-3A10 10 0 0 0 3.3 7.4L6.6 10A5.8 5.8 0 0 1 12 5.9Z"
			/>
		</svg>
	);
}

const socialButtonBase =
	"inline-flex h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-white px-3 text-sm font-medium shadow-[var(--shadow-xs)] transition-[color,background-color,border-color,box-shadow] disabled:pointer-events-none disabled:opacity-50 dark:bg-input";

const googleButtonClass = `${socialButtonBase} text-[#3c4043] hover:bg-[#e8f0fe] hover:shadow-[0_1px_3px_rgb(60_64_67/0.24)] dark:text-[#f1f3f4] dark:hover:bg-[#303134]`;

const githubButtonClass = `${socialButtonBase} text-[#1f2328] hover:bg-[#eaeef2] hover:shadow-[0_1px_3px_rgb(31_35_40/0.18)] dark:text-[#f0f6fc] dark:hover:bg-[#30363d]`;

interface SocialAuthButtonsProps {
	callbackError?: { code: string; provider: SocialProvider };
	callbackPath: string;
	errorPath: string;
}

export function SocialAuthButtons({
	callbackError,
	callbackPath,
	errorPath,
}: SocialAuthButtonsProps) {
	const [pendingProvider, setPendingProvider] = useState<SocialProvider>();
	const [requestError, setRequestError] = useState("");

	async function continueWith(provider: SocialProvider) {
		setPendingProvider(provider);
		setRequestError("");

		const errorCallbackURL = new URL(errorPath, window.location.origin);
		errorCallbackURL.searchParams.set("social", provider);

		try {
			const result = await authClient.signIn.social({
				provider,
				callbackURL: new URL(callbackPath, window.location.origin).toString(),
				errorCallbackURL: errorCallbackURL.toString(),
			});
			if (result.error) {
				setRequestError(socialAuthError(provider, result.error.code));
				setPendingProvider(undefined);
			}
		} catch {
			setRequestError(socialAuthError(provider));
			setPendingProvider(undefined);
		}
	}

	const error =
		requestError ||
		(callbackError ? socialAuthError(callbackError.provider, callbackError.code) : "");

	return (
		<div className="grid gap-3">
			<div className="grid grid-cols-2 gap-2.5">
				<button
					className={googleButtonClass}
					type="button"
					disabled={Boolean(pendingProvider)}
					onClick={() => continueWith("google")}
				>
					<GoogleIcon />
					{pendingProvider === "google" ? "Abrindo…" : "Google"}
				</button>
				<button
					className={githubButtonClass}
					type="button"
					disabled={Boolean(pendingProvider)}
					onClick={() => continueWith("github")}
				>
					<Github aria-hidden="true" size={17} />
					{pendingProvider === "github" ? "Abrindo…" : "GitHub"}
				</button>
			</div>
			{error ? (
				<p className="m-0 text-[13px] text-destructive" role="alert">
					{error}
				</p>
			) : null}
			<div
				className="flex items-center gap-3 text-[11px] text-muted-foreground"
				aria-hidden="true"
			>
				<span className="h-px flex-1 bg-border" />
				<span>ou use seu e-mail</span>
				<span className="h-px flex-1 bg-border" />
			</div>
		</div>
	);
}
