import type { UserSettingsType } from "./schemas";

export type UserSettingsRecord = Pick<UserSettingsType, "theme" | "connectionId">;
export const DEFAULT_SETTINGS: UserSettingsRecord = {
	theme: "system",
	// No connection is selected until the user picks one. Null means "show nothing",
	// never "show every connection" — see `resolveConnectionScope`.
	connectionId: null,
};
