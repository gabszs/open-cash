import type { FormEvent } from "react";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { SocialProvider } from "@/components/socialAuthButtons";

import { AuthLayout } from "@/components/authLayout";
import { RoutePending } from "@/components/routePending";
import { isSocialProvider, SocialAuthButtons } from "@/components/socialAuthButtons";
import { authCardClass, buttonClass, eyebrowClass, inputClass } from "@/components/ui/styles";
import { authClient } from "@/lib/authClient";
import { redirectIfAuthenticated } from "@/lib/routeGuards";

interface SignInSearch {
	error?: string;
	redirect?: string;
	social?: SocialProvider;
	verified?: boolean;
}

function safeRedirect(value: unknown) {
	return typeof value === "string" &&
		value.startsWith("/") &&
		!value.startsWith("//") &&
		value !== "/auth/sign-in"
		? value
		: undefined;
}

/** Códigos que o Better Auth anexa ao voltar de `/verify-email`. */
const verificationErrors: Record<string, string> = {
	INVALID_TOKEN: "Link de confirmação inválido. Peça um novo entrando com seu e-mail e senha.",
	TOKEN_EXPIRED: "O link de confirmação expirou. Entre novamente para receber outro.",
	USER_NOT_FOUND: "Não encontramos a conta deste link de confirmação.",
};

export const Route = createFileRoute("/auth/sign-in")({
	validateSearch: (search: Record<string, unknown>): SignInSearch => ({
		error: typeof search.error === "string" ? search.error : undefined,
		redirect: safeRedirect(search.redirect),
		social: isSocialProvider(search.social) ? search.social : undefined,
		verified: search.verified === "1" || search.verified === true,
	}),
	beforeLoad: ({ context, search }) =>
		redirectIfAuthenticated({ authClient: context.authClient, to: search.redirect }),
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: SignInPage,
	pendingComponent: RoutePending,
	errorComponent: ({ error }) => (
		<p className="p-6 text-[13px] text-destructive">{error.message}</p>
	),
});

function SignInPage() {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
	const [totp, setTotp] = useState("");

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError("");
		if (requiresTwoFactor) {
			const verification = await authClient.twoFactor.verifyTotp({
				code: totp,
				trustDevice: true,
			});
			setPending(false);
			if (verification.error) {
				setError(verification.error.message ?? "Código inválido.");
				return;
			}
			await navigate({ to: search.redirect ?? "/chat", replace: true });
			return;
		}
		const data = new FormData(event.currentTarget);
		const result = await authClient.signIn.email({
			email: String(data.get("email")),
			password: String(data.get("password")),
		});
		setPending(false);
		if (result.error) {
			setError(result.error.message ?? "Não foi possível entrar.");
			return;
		}
		const twoFactorRedirect = Boolean(
			(result.data as unknown as { twoFactorRedirect?: boolean }).twoFactorRedirect,
		);
		if (twoFactorRedirect) {
			setRequiresTwoFactor(true);
			return;
		}
		await navigate({ to: search.redirect ?? "/chat", replace: true });
	}

	// A verificação de e-mail não autentica ninguém: o link volta para cá, e o
	// aviso é o que liga o clique no e-mail ao formulário embaixo dele.
	const verificationError =
		search.error && !search.social
			? (verificationErrors[search.error] ?? "Não foi possível confirmar o e-mail.")
			: undefined;
	const verifiedNotice = search.verified && !verificationError;
	const socialCallbackError =
		search.social && search.error ? { code: search.error, provider: search.social } : undefined;
	const socialErrorPath = search.redirect
		? `/auth/sign-in?redirect=${encodeURIComponent(search.redirect)}`
		: "/auth/sign-in";

	let submitLabel = "Entrar";
	if (requiresTwoFactor) {
		submitLabel = "Verificar código";
	}
	if (pending) {
		submitLabel = "Entrando…";
	}

	return (
		<AuthLayout>
			<form className={authCardClass} onSubmit={submit}>
				<div>
					<p className={eyebrowClass}>Bem-vindo de volta</p>
					<h1>Entre na sua conta</h1>
					<p>Use seu e-mail e senha para continuar.</p>
				</div>
				<SocialAuthButtons
					callbackError={socialCallbackError}
					callbackPath={search.redirect ?? "/chat"}
					errorPath={socialErrorPath}
				/>
				{verifiedNotice ? (
					<output className="m-0 block rounded-md border border-border bg-secondary px-3 py-2 text-[13px] text-foreground">
						E-mail confirmado. Entre para acessar sua conta.
					</output>
				) : null}
				{verificationError ? (
					<p className="m-0 text-[13px] text-destructive" role="alert">
						{verificationError}
					</p>
				) : null}
				{requiresTwoFactor ? (
					<label>
						Código do autenticador
						<input
							className={inputClass}
							value={totp}
							onChange={(event) => setTotp(event.target.value)}
							inputMode="numeric"
							autoComplete="one-time-code"
							required
							autoFocus
						/>
					</label>
				) : (
					<>
						<label>
							E-mail
							<input
								className={inputClass}
								name="email"
								type="email"
								autoComplete="email"
								required
							/>
						</label>
						<label>
							Senha
							<input
								className={inputClass}
								name="password"
								type="password"
								autoComplete="current-password"
								required
								minLength={8}
							/>
						</label>
					</>
				)}
				{error ? (
					<p className="text-[13px] text-destructive" role="alert">
						{error}
					</p>
				) : null}
				<button className={buttonClass({ full: true })} type="submit" disabled={pending}>
					{submitLabel}
				</button>
				<p className="m-0 text-center text-[13px] text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-[3px]">
					Ainda não tem conta? <Link to="/auth/sign-up">Cadastre-se</Link>
				</p>
			</form>
		</AuthLayout>
	);
}
