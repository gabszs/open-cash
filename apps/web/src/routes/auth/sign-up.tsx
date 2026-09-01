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

interface SignUpSearch {
	error?: string;
	social?: SocialProvider;
}

export const Route = createFileRoute("/auth/sign-up")({
	validateSearch: (search: Record<string, unknown>): SignUpSearch => ({
		error: typeof search.error === "string" ? search.error : undefined,
		social: isSocialProvider(search.social) ? search.social : undefined,
	}),
	beforeLoad: ({ context }) => redirectIfAuthenticated({ authClient: context.authClient }),
	// oxlint-disable-next-line no-use-before-define -- file routes are declared before their components
	component: SignUpPage,
	pendingComponent: RoutePending,
	errorComponent: ({ error }) => (
		<p className="p-6 text-[13px] text-destructive">{error.message}</p>
	),
});

function SignUpPage() {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const socialCallbackError =
		search.social && search.error ? { code: search.error, provider: search.social } : undefined;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError("");
		const data = new FormData(event.currentTarget);
		const result = await authClient.signUp.email({
			name: String(data.get("name")),
			email: String(data.get("email")),
			password: String(data.get("password")),
		});
		setPending(false);
		if (result.error) {
			setError(result.error.message ?? "Não foi possível criar a conta.");
			return;
		}
		await navigate({ to: "/auth/sign-in", search: {}, replace: true });
	}

	return (
		<AuthLayout>
			<form className={authCardClass} onSubmit={submit}>
				<div>
					<p className={eyebrowClass}>Primeiros passos</p>
					<h1>Crie sua conta</h1>
					<p>Conecte suas finanças e converse com seus dados em segurança.</p>
				</div>
				<SocialAuthButtons
					callbackError={socialCallbackError}
					callbackPath="/chat"
					errorPath="/auth/sign-up"
				/>
				<label>
					Nome
					<input className={inputClass} name="name" autoComplete="name" required />
				</label>
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
						autoComplete="new-password"
						required
						minLength={8}
					/>
				</label>
				{error ? (
					<p className="text-[13px] text-destructive" role="alert">
						{error}
					</p>
				) : null}
				<button className={buttonClass({ full: true })} type="submit" disabled={pending}>
					{pending ? "Criando…" : "Criar conta"}
				</button>
				<p className="m-0 text-center text-[13px] text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-[3px]">
					Já tem uma conta?{" "}
					<Link to="/auth/sign-in" search={{}}>
						Entrar
					</Link>
				</p>
			</form>
		</AuthLayout>
	);
}
