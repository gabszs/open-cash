import * as authModels from "./authModels";
import { connections } from "./connections";
import { conversations } from "./conversations";
import { userSettings } from "./userSettings";

export const models = {
	...authModels,
	connections,
	conversations,
	userSettings,
} as const;

export type UserSettingsTable = typeof userSettings;
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
