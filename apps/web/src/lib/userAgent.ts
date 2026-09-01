const browsers = [
	// Order matters: Chromium forks all advertise "Chrome", and modern Edge sends "Edg".
	{ label: "Edge", token: "Edg" },
	{ label: "Opera", token: "OPR" },
	{ label: "Firefox", token: "Firefox" },
	{ label: "Chrome", token: "Chrome" },
	{ label: "Safari", token: "Safari" },
] as const;

const systems = [
	{ label: "iOS", tokens: ["iPhone", "iPad", "iPod"] },
	{ label: "Android", tokens: ["Android"] },
	{ label: "Windows", tokens: ["Windows"] },
	{ label: "macOS", tokens: ["Macintosh", "Mac OS"] },
	{ label: "Linux", tokens: ["Linux"] },
] as const;

/** Turns a raw user agent into a "Chrome · macOS" style label for the sessions list. */
export function describeDevice(userAgent?: string | null) {
	if (!userAgent) return "Dispositivo desconhecido";
	const browser = browsers.find((item) => userAgent.includes(item.token))?.label;
	const system = systems.find((item) =>
		item.tokens.some((token) => userAgent.includes(token)),
	)?.label;
	if (!browser && !system) return "Dispositivo desconhecido";
	return [browser, system].filter(Boolean).join(" · ");
}
