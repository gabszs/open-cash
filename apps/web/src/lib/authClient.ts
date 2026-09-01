import { agentAuthClient } from "@better-auth/agent-auth/client";
import { apiKeyClient } from "@better-auth/api-key/client";
import { cloudflareClient } from "better-auth-cloudflare/client";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787",
	basePath: "/v1/auth",
	// `bearer()` no servidor não tem contraparte aqui: o plugin é só de servidor e
	// o browser continua no cookie. Quem precisar do token cru lê o header
	// `set-auth-token` num `fetchOptions.onSuccess`.
	plugins: [
		agentAuthClient(),
		adminClient(),
		twoFactorClient(),
		apiKeyClient(),
		cloudflareClient(),
	],
});
