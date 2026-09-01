import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		const { data: session } = await context.authClient.getSession();
		throw redirect({ to: session ? "/chat" : "/auth/sign-in", search: {}, replace: true });
	},
});
