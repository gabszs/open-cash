import { EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME } from "./constants";

interface ActionEmailInput {
	action: string;
	body: string;
	footer: string;
	heading: string;
	subject: string;
	url: string;
}

interface OutgoingEmail {
	html: string;
	subject: string;
	text: string;
	to: string;
}

interface AuthEmailInput {
	name?: string;
	to: string;
	url: string;
}

const HTML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

const escapeHtml = (value: string) =>
	value.replaceAll(/[&<>"']/gu, (character) => HTML_ENTITIES[character] ?? character);

const greeting = (name?: string) => (name?.trim() ? `Hi ${name.trim()},` : "Hi,");

const renderActionEmail = ({ action, body, footer, heading, subject, url }: ActionEmailInput) => ({
	html: `<!doctype html>
<html lang="en">
	<body style="margin:0;padding:24px;background:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
			<tr><td>
				<h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">${escapeHtml(heading)}</h1>
				<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(body)}</p>
				<p style="margin:0 0 24px;">
					<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#18181b;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;">${escapeHtml(action)}</a>
				</p>
				<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#52525b;">Or paste this link into your browser:</p>
				<p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#2563eb;">${escapeHtml(url)}</a></p>
				<p style="margin:0;font-size:13px;line-height:1.6;color:#52525b;">${escapeHtml(footer)}</p>
			</td></tr>
		</table>
	</body>
</html>`,
	subject,
	text: [heading, "", body, "", `${action}: ${url}`, "", footer].join("\n"),
});

/**
 * Dispatches a message through the Cloudflare Email Sending binding.
 *
 * The binding is unavailable when Better Auth is instantiated outside a request
 * (CLI schema generation) and cannot deliver in `wrangler dev` unless the
 * binding runs against remote infrastructure, so outside production the message
 * is logged instead — the text body carries the action link developers need.
 */
export const sendEmail = async (env: Env | undefined, message: OutgoingEmail) => {
	const isProduction = String(env?.ENVIRONMENT) === "production";

	if (!env?.EMAIL) {
		if (isProduction) throw new Error("The EMAIL binding is not configured on this Worker.");

		console.warn(`[email] no EMAIL binding; skipped "${message.subject}"\n${message.text}`);
		return;
	}

	try {
		await env.EMAIL.send({
			from: {
				email: env.EMAIL_FROM_ADDRESS ?? EMAIL_FROM_ADDRESS,
				name: env.EMAIL_FROM_NAME ?? EMAIL_FROM_NAME,
			},
			html: message.html,
			subject: message.subject,
			text: message.text,
			to: message.to,
		});
	} catch (error) {
		if (isProduction) throw error;

		console.warn(`[email] delivery failed for "${message.subject}"\n${message.text}`, error);
	}
};

export const sendVerificationEmail = (env: Env | undefined, { name, to, url }: AuthEmailInput) =>
	sendEmail(env, {
		to,
		...renderActionEmail({
			action: "Verify email",
			body: `${greeting(name)} confirm this address to finish setting up your ${EMAIL_FROM_NAME} account.`,
			footer: "If you did not create this account, you can safely ignore this email.",
			heading: "Verify your email address",
			subject: `Verify your ${EMAIL_FROM_NAME} email address`,
			url,
		}),
	});

export const sendResetPasswordEmail = (env: Env | undefined, { name, to, url }: AuthEmailInput) =>
	sendEmail(env, {
		to,
		...renderActionEmail({
			action: "Reset password",
			body: `${greeting(name)} we received a request to reset the password for your ${EMAIL_FROM_NAME} account.`,
			footer: "If you did not request a password reset, ignore this email and your password stays unchanged.",
			heading: "Reset your password",
			subject: `Reset your ${EMAIL_FROM_NAME} password`,
			url,
		}),
	});
