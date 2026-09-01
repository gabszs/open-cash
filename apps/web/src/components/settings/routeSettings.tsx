import { BookOpen } from "lucide-react";

import { SettingsSection } from "@/components/settings/settingsPrimitives";
import { badgeClass, buttonClass, listCardClass } from "@/components/ui/styles";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";

const routes = [
	{
		method: "POST",
		path: `${serverUrl}/mcp`,
		title: "Finance MCP",
		detail: "Sessão Better Auth, API key pessoal ou token interno do agente.",
	},
	{
		method: "GET",
		path: `${serverUrl}/v1/finance/accounts`,
		title: "Contas",
		detail: "Contas e cartões consolidados do usuário.",
	},
	{
		method: "GET",
		path: `${serverUrl}/v1/finance/transactions`,
		title: "Transações",
		detail: "Consulta paginada por período e conta.",
	},
	{
		method: "GET",
		path: `${serverUrl}/v1/finance/investments`,
		title: "Investimentos",
		detail: "Posições, quantidades e totais por moeda.",
	},
	{
		method: "GET POST HEAD",
		path: `${serverUrl}/ai/finance/:conversationId`,
		title: "Agente Flue · stream",
		detail: "Envio e leitura durável por SSE, encaminhados por Service Binding.",
	},
	{
		method: "POST",
		path: `${serverUrl}/ai/finance/:conversationId/abort`,
		title: "Agente Flue · abortar",
		detail: "Interrompe a execução ativa sem apagar o histórico durável.",
	},
	{
		method: "GET",
		path: `${serverUrl}/v1/conversations/:conversationId/files`,
		title: "Arquivos da conversa · lista",
		detail: "Anexos enviados e artefatos publicados pelo agente, com cursor.",
	},
	{
		method: "PUT GET DELETE",
		path: `${serverUrl}/v1/conversations/:conversationId/files/:fileId`,
		title: "Arquivos da conversa · item",
		detail: "Envia, baixa e apaga um arquivo usando a sessão autenticada.",
	},
];

export function RouteSettings() {
	return (
		<SettingsSection description="Contratos disponíveis para sua conta e clientes autorizados.">
			<div className={listCardClass}>
				{routes.map((route) => (
					<div
						className="grid grid-cols-[56px_minmax(0,1fr)] gap-2.5 px-3 py-2.5 [&+&]:border-t [&+&]:border-border"
						key={route.path}
					>
						<b className={`${badgeClass} h-fit justify-center font-mono text-[9px]`}>
							{route.method}
						</b>
						<div className="grid min-w-0 gap-0.5">
							<strong>{route.title}</strong>
							<code className="overflow-hidden text-ellipsis text-[11px] text-brand">
								{route.path}
							</code>
							<small className="text-xs text-muted-foreground">{route.detail}</small>
						</div>
					</div>
				))}
			</div>
			<a
				className={buttonClass({ variant: "secondary", size: "sm" })}
				href={`${serverUrl}/v1/auth/docs`}
				target="_blank"
				rel="noreferrer"
			>
				<BookOpen size={14} /> Abrir documentação de autenticação
			</a>
		</SettingsSection>
	);
}
