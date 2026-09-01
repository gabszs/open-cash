import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { SettingsSection } from "@/components/settings/settingsPrimitives";
import { Avatar } from "@/components/ui/avatar";
import {
	buttonClass,
	calloutClass,
	listActionsClass,
	listCardClass,
	listContentClass,
} from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/authClient";

interface AdminUser {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
	createdAt: Date | string;
}

export function AdminSettings() {
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const users = useQuery({
		queryKey: ["admin", "users"],
		queryFn: async () => {
			const result = await authClient.admin.listUsers({
				query: { limit: 50, offset: 0, sortBy: "createdAt", sortDirection: "desc" },
			});
			if (result.error) {
				throw new Error(result.error.message ?? "Falha ao carregar usuários.");
			}
			return (result.data?.users ?? []) as AdminUser[];
		},
	});

	async function changeRole(user: AdminUser) {
		const role = user.role?.split(",").includes("admin") ? "user" : "admin";
		const result = await authClient.admin.setRole({ userId: user.id, role });
		if (result.error) {
			toast.error(result.error.message ?? "Falha ao alterar papel.");
			return;
		}
		toast.success(`Papel alterado para ${role}.`);
		await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
	}

	async function toggleBan(user: AdminUser) {
		const result = user.banned
			? await authClient.admin.unbanUser({ userId: user.id })
			: await authClient.admin.banUser({ userId: user.id, banReason: "Ação administrativa" });
		if (result.error) {
			toast.error(result.error.message ?? "Falha ao alterar acesso.");
			return;
		}
		toast.success(user.banned ? "Usuário desbloqueado." : "Usuário bloqueado.");
		await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
	}

	return (
		<SettingsSection description="Visão operacional do plugin Admin do Better Auth.">
			<div className={calloutClass}>
				<Users size={16} />
				<div>
					<strong>{users.data?.length ?? 0} usuários carregados</strong>
					<span>O backend aplica as permissões administrativas em todas as ações.</span>
				</div>
			</div>
			<div className={listCardClass}>
				{users.data?.map((user) => (
					<article key={user.id}>
						<Avatar name={user.name} />
						<div className={listContentClass}>
							<strong>{user.name}</strong>
							<small>{user.email}</small>
						</div>
						<div className={listActionsClass}>
							<button
								className={buttonClass({ variant: "ghost", size: "sm" })}
								type="button"
								onClick={() => changeRole(user)}
							>
								{user.role?.includes("admin") ? "Remover admin" : "Tornar admin"}
							</button>
							<button
								className={buttonClass({ variant: "ghost", size: "sm" })}
								type="button"
								onClick={() => toggleBan(user)}
							>
								<span className={user.banned ? "text-positive" : "text-negative"}>
									{user.banned ? "Desbloquear" : "Bloquear"}
								</span>
							</button>
						</div>
					</article>
				))}
			</div>
		</SettingsSection>
	);
}
