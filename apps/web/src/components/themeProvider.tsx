import type { PropsWithChildren } from "react";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import { orpcClient } from "@/lib/orpc";

export type Theme = "light" | "dark";

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function readStoredTheme(): Theme {
	return localStorage.getItem("theme") === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
	document.documentElement.classList.toggle("dark", theme === "dark");
	localStorage.setItem("theme", theme);
}

export function ThemeProvider({ children }: PropsWithChildren) {
	const [theme, setTheme] = useState<Theme>(readStoredTheme);

	useEffect(() => applyTheme(theme), [theme]);

	// The server owns the persisted preference; hydrate it once on mount.
	useEffect(() => {
		let active = true;
		void orpcClient.settings
			.get()
			.then(({ theme: savedTheme }) => {
				if (active && (savedTheme === "light" || savedTheme === "dark")) {
					setTheme(savedTheme);
				}
			})
			.catch(() => null);
		return () => {
			active = false;
		};
	}, []);

	const changeTheme = useCallback((next: Theme) => {
		setTheme(next);
		applyTheme(next);
		void orpcClient.settings.update({ theme: next }).catch(() => null);
	}, []);

	const value = useMemo(() => ({ theme, setTheme: changeTheme }), [theme, changeTheme]);

	return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
	const context = use(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used inside ThemeProvider");
	}
	return context;
}
