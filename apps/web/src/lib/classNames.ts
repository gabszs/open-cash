export type ClassNameValue = string | false | null | undefined;

export const cn = (...values: ClassNameValue[]) => values.filter(Boolean).join(" ");
