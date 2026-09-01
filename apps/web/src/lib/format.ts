const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });
const shortDateTime = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeStyle: "short",
});

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput) {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: DateInput, fallback = "—") {
	const date = toDate(value);
	return date ? longDate.format(date) : fallback;
}

export function formatDateTime(value: DateInput, fallback = "—") {
	const date = toDate(value);
	return date ? shortDateTime.format(date) : fallback;
}

export function formatMoney(value?: string, currency = "BRL") {
	return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
		Number(value ?? 0),
	);
}

/**
 * `yyyy-mm-dd` in LOCAL time, for `<input type="date">`. `toISOString` would shift
 * the day in negative UTC offsets.
 */
export function toDateInputValue(value: DateInput) {
	const date = toDate(value);
	if (!date) return "";
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight `days` from today, as a `<input type="date">` value. */
export function dateInputOffsetFromToday(days: number) {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() + days);
	return toDateInputValue(date);
}

/** Parses a `<input type="date">` value as local midnight (the browser parses it as UTC). */
export function parseDateInputValue(value: string) {
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return null;
	return new Date(year, month - 1, day);
}
