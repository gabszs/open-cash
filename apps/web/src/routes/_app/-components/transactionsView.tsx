import type { ClassNames, DateRange } from "@daypicker/react";
import type {
	FinanceAccount,
	FinanceTransaction,
	FinanceTransactionsSummary,
} from "@server/features/finance/schemas";

import { DayPicker } from "@daypicker/react";
import { ptBR } from "@daypicker/react/locale";
import {
	ArrowDownRight,
	ArrowUpRight,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	Landmark,
	LoaderCircle,
	Search,
	WalletCards,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { TransactionDirection, TransactionSearch } from "@/lib/transactionFilters";

import { CopyButton } from "@/components/chat/copyButton";
import { buttonClass } from "@/components/ui/styles";
import { formatMoney } from "@/lib/format";
import {
	CATEGORY_LABELS,
	localDateValue,
	localMonthValue,
	shiftTransactionPeriod,
} from "@/lib/transactionFilters";

interface FilterBarProps {
	accounts: FinanceAccount[];
	search: TransactionSearch;
	onChange: (next: Partial<TransactionSearch>) => void;
}

const accountLabel = (account: FinanceAccount) => {
	if (account.type === "CREDIT") return account.credit?.brand ?? "Cartão de crédito";
	if (account.subtype === "CHECKING_ACCOUNT") return "Conta corrente";
	if (account.subtype === "SAVINGS_ACCOUNT") return "Conta poupança";
	return account.subtype?.replaceAll("_", " ").toLocaleLowerCase("pt-BR") ?? "Conta bancária";
};

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
	weekday: "long",
	day: "2-digit",
	month: "long",
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const rangeFormat = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "short",
	year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "medium",
	timeStyle: "short",
});

const localDate = (value: string) => new Date(`${value}T12:00:00`);
const sentenceCase = (value: string) => value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
const formatDay = (value: string) => sentenceCase(dayFormat.format(localDate(value)));
const formatMonth = (value: string) => sentenceCase(monthFormat.format(localDate(`${value}-01`)));
const formatRange = (from: string, to: string) =>
	`${rangeFormat.format(localDate(from))} – ${rangeFormat.format(localDate(to))}`;

const calendarClassNames = {
	root: "relative m-0 text-xs",
	months: "relative flex max-w-fit flex-wrap gap-5",
	month: "relative",
	month_caption: "flex h-11 items-center text-[13px] font-semibold",
	caption_label: "relative z-1 inline-flex items-center whitespace-nowrap border-0",
	nav: "absolute top-0 right-0 flex h-11 items-center",
	button_previous:
		"relative inline-flex size-9 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-inherit aria-disabled:cursor-default aria-disabled:opacity-50",
	button_next:
		"relative inline-flex size-9 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-inherit aria-disabled:cursor-default aria-disabled:opacity-50",
	chevron: "inline-block fill-brand",
	month_grid: "border-collapse",
	weekday: "w-9 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase",
	day: "size-9 text-center",
	day_button:
		"m-0 flex size-8.5 cursor-pointer items-center justify-center rounded-full border-2 border-transparent bg-transparent p-0 text-inherit hover:bg-accent disabled:cursor-default",
	today: "text-brand",
	selected: "text-base font-bold [&>button]:border-brand",
	disabled: "not-data-[selected]:opacity-50",
	outside: "opacity-75",
	hidden: "invisible",
	range_start:
		"bg-[linear-gradient(90deg,transparent_50%,color-mix(in_oklab,var(--brand)_14%,transparent)_50%)] [&>button]:bg-brand [&>button]:text-primary-foreground",
	range_middle:
		"bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] [&>button]:rounded-none [&>button]:border-0",
	range_end:
		"bg-[linear-gradient(90deg,color-mix(in_oklab,var(--brand)_14%,transparent)_50%,transparent_50%)] [&>button]:bg-brand [&>button]:text-primary-foreground",
} satisfies Partial<ClassNames>;

const selectedAccountsLabel = (selectedIds: string[], accounts: FinanceAccount[]) => {
	if (selectedIds.length === 0) return "Todas as contas";
	if (selectedIds.length > 1) return `${selectedIds.length} contas selecionadas`;
	return accounts.find(({ id }) => id === selectedIds[0])?.name ?? "1 conta selecionada";
};

const useCompactCalendar = () => {
	const [compact, setCompact] = useState(
		() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches,
	);
	useEffect(() => {
		const media = window.matchMedia("(max-width: 720px)");
		const update = () => setCompact(media.matches);
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	return compact;
};

function PeriodNavigator({ search, onChange }: Pick<FilterBarProps, "search" | "onChange">) {
	const compact = useCompactCalendar();
	const containerRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [draftRange, setDraftRange] = useState<DateRange | undefined>();
	const now = new Date();
	const nextPeriod = shiftTransactionPeriod(search, 1, now);
	const canGoNext = nextPeriod.to <= localDateValue(now);
	const label =
		search.period === "month" ? formatMonth(search.month) : formatRange(search.from, search.to);

	useEffect(() => {
		if (!open) return;
		const closeOnOutside = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutside);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutside);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [open]);

	const openCalendar = () => {
		setDraftRange({ from: localDate(search.from), to: localDate(search.to) });
		setOpen(true);
	};

	const move = (direction: -1 | 1) => onChange(shiftTransactionPeriod(search, direction, now));
	const applyRange = () => {
		if (!draftRange?.from || !draftRange.to) return;
		const from = localDateValue(draftRange.from);
		const to = localDateValue(draftRange.to);
		onChange({ period: "custom", from, to, month: localMonthValue(draftRange.from) });
		setOpen(false);
	};

	return (
		<div
			className="relative flex min-w-[min(360px,100%)] items-center gap-2 max-mobile:w-full"
			ref={containerRef}
		>
			<div
				className="grid h-10.5 min-w-0 flex-1 grid-cols-[40px_minmax(170px,1fr)_40px] items-center rounded-md border border-border bg-input shadow-[var(--shadow-xs)] [&>button]:grid [&>button]:h-full [&>button]:cursor-pointer [&>button]:place-items-center [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-muted-foreground [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:hover:not(:disabled)]:bg-accent [&>button:hover:not(:disabled)]:text-foreground [&>button:disabled]:cursor-not-allowed [&>button:disabled]:opacity-35 [&>strong]:truncate [&>strong]:text-center [&>strong]:text-[13px] [&>strong]:font-semibold"
				aria-label="Período das transações"
			>
				<button aria-label="Período anterior" onClick={() => move(-1)} type="button">
					<ChevronLeft size={16} />
				</button>
				<strong>{label}</strong>
				<button
					aria-label="Próximo período"
					disabled={!canGoNext}
					onClick={() => move(1)}
					type="button"
				>
					<ChevronRight size={16} />
				</button>
			</div>
			<button
				aria-controls="transaction-range-calendar"
				aria-expanded={open}
				aria-label="Selecionar intervalo personalizado"
				className="grid size-10.5 shrink-0 basis-10.5 cursor-pointer place-items-center rounded-md border border-border bg-input p-0 text-muted-foreground shadow-[var(--shadow-xs)] hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
				onClick={() => (open ? setOpen(false) : openCalendar())}
				type="button"
			>
				<CalendarDays size={16} />
			</button>
			{open ? (
				<dialog
					aria-label="Escolher intervalo de datas"
					className="absolute top-[calc(100%+8px)] left-0 z-40 m-0 max-h-[calc(100vh-120px)] w-max max-w-[calc(100vw-40px)] overflow-auto rounded-lg border border-sidebar-border bg-popover p-3.5 text-foreground shadow-[var(--shadow-lg)] max-mobile:right-0 max-mobile:left-0 max-mobile:w-full max-mobile:max-w-none"
					id="transaction-range-calendar"
					open
				>
					<DayPicker
						classNames={calendarClassNames}
						defaultMonth={draftRange?.from}
						disabled={{ after: now }}
						endMonth={now}
						locale={ptBR}
						mode="range"
						numberOfMonths={compact ? 1 : 2}
						onSelect={setDraftRange}
						selected={draftRange}
						showOutsideDays={compact}
					/>
					<div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3 max-mobile:items-stretch max-mobile:flex-col">
						<span className="text-[11px] text-muted-foreground">
							{draftRange?.from && draftRange.to
								? formatRange(
										localDateValue(draftRange.from),
										localDateValue(draftRange.to),
									)
								: "Selecione o início e o fim"}
						</span>
						<div className="flex gap-1.5 max-mobile:[&_button]:flex-1">
							<button
								className={buttonClass({
									variant: "ghost",
									className: "min-h-8 px-2.5",
								})}
								onClick={() => setOpen(false)}
								type="button"
							>
								Cancelar
							</button>
							<button
								className={buttonClass({ className: "min-h-8 px-2.5" })}
								disabled={!draftRange?.from || !draftRange.to}
								onClick={applyRange}
								type="button"
							>
								Aplicar
							</button>
						</div>
					</div>
				</dialog>
			) : null}
		</div>
	);
}

function TransactionSearchField({
	onChange,
	value,
}: {
	onChange: FilterBarProps["onChange"];
	value: string;
}) {
	const [query, setQuery] = useState(value);
	useEffect(() => {
		const normalized = query.trim();
		if (normalized === value) return;
		const timeout = window.setTimeout(() => onChange({ query: normalized }), 300);
		return () => window.clearTimeout(timeout);
	}, [onChange, query, value]);

	return (
		<label className="flex h-9 min-w-[min(420px,100%)] items-center gap-2 rounded-md border border-border bg-input px-2.5 text-muted-foreground shadow-[var(--shadow-xs)] focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_16%,transparent)] max-mobile:w-full max-mobile:min-w-0 [&>button]:grid [&>button]:size-6 [&>button]:cursor-pointer [&>button]:place-items-center [&>button]:rounded-sm [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-muted-foreground [&>button:hover]:bg-accent [&>button:hover]:text-foreground">
			<Search size={15} />
			<input
				className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-xs shadow-none outline-0 placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
				aria-label="Buscar transações"
				maxLength={120}
				onChange={(event) => setQuery(event.currentTarget.value)}
				placeholder="Buscar por descrição, contraparte ou documento"
				type="search"
				value={query}
			/>
			{query ? (
				<button aria-label="Limpar busca" onClick={() => setQuery("")} type="button">
					<X size={14} />
				</button>
			) : null}
		</label>
	);
}

export function TransactionFilterBar({ accounts, search, onChange }: FilterBarProps) {
	const institutions = useMemo(() => {
		const grouped = new Map<string, FinanceAccount[]>();
		for (const account of accounts) {
			grouped.set(account.institution, [
				...(grouped.get(account.institution) ?? []),
				account,
			]);
		}
		return [...grouped];
	}, [accounts]);
	const selected = new Set(search.accounts);
	const sourceLabel = selectedAccountsLabel(search.accounts, accounts);

	const toggleAccount = (accountId: string) => {
		const next = new Set(search.accounts);
		if (next.has(accountId)) next.delete(accountId);
		else next.add(accountId);
		onChange({ accounts: [...next].toSorted() });
	};

	return (
		<section
			className="mb-3 grid gap-3 rounded-lg border border-border bg-card p-3.5 max-mobile:p-2.75"
			aria-label="Filtros das transações"
		>
			<div className="flex min-w-0 items-center gap-2.5 max-wide:flex-wrap max-mobile:flex-col max-mobile:items-stretch">
				<PeriodNavigator onChange={onChange} search={search} />
				<details className="group/accounts relative ml-auto min-w-55 max-wide:ml-0 max-shell:flex-1 max-mobile:w-full max-mobile:min-w-0">
					<summary className="flex h-10.5 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-input px-2.5 text-xs text-muted-foreground shadow-[var(--shadow-xs)] [&::-webkit-details-marker]:hidden [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-foreground [&>svg:last-child]:transition-transform group-open/accounts:[&>svg:last-child]:rotate-180">
						<WalletCards size={15} />
						<span>{sourceLabel}</span>
						<ChevronDown size={14} />
					</summary>
					<div className="absolute top-[calc(100%+6px)] right-0 z-30 max-h-90 w-[min(360px,calc(100vw-40px))] overflow-y-auto rounded-lg border border-sidebar-border bg-popover p-1.5 shadow-[var(--shadow-lg)]">
						<div className="flex items-start justify-between gap-2.5 p-2">
							<div className="grid gap-0.5">
								<strong className="text-[13px] font-medium">
									Contas e cartões
								</strong>
								<small className="text-[11px] text-muted-foreground">
									Combine quantas fontes precisar
								</small>
							</div>
							{search.accounts.length > 0 ? (
								<button
									className="cursor-pointer border-0 bg-transparent px-1 py-0.5 text-[11px] text-brand"
									type="button"
									onClick={() => onChange({ accounts: [] })}
								>
									Limpar
								</button>
							) : null}
						</div>
						{institutions.length === 0 ? (
							<span className="block px-2 py-3.5 text-[11px] text-muted-foreground">
								Nenhuma conta disponível.
							</span>
						) : (
							institutions.map(([institution, rows]) => (
								<div
									className="grid gap-0.5 border-t border-border pt-1.25"
									key={institution}
								>
									<strong className="px-2 pt-1.25 pb-0.75 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
										{institution}
									</strong>
									{rows.map((account) => (
										<label
											className="relative grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_18px] items-center gap-2 rounded-md px-2 py-1.75 hover:bg-accent"
											key={account.id}
										>
											<input
												className="peer absolute size-px opacity-0"
												type="checkbox"
												checked={selected.has(account.id)}
												onChange={() => toggleAccount(account.id)}
											/>
											<span className="grid size-7 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
												{account.type === "CREDIT" ? (
													<CreditCard size={14} />
												) : (
													<Landmark size={14} />
												)}
											</span>
											<span className="grid min-w-0 gap-px">
												<b className="truncate text-xs font-medium">
													{account.name}
												</b>
												<small className="text-[11px] text-muted-foreground capitalize">
													{accountLabel(account)}
												</small>
											</span>
											<Check
												className="text-brand opacity-0 peer-checked:opacity-100"
												size={14}
											/>
										</label>
									))}
								</div>
							))
						)}
					</div>
				</details>
			</div>

			<div className="flex items-center justify-between gap-3 border-t border-border pt-3 max-mobile:flex-col max-mobile:items-start">
				<TransactionSearchField
					key={search.query}
					onChange={onChange}
					value={search.query}
				/>
				<div
					className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary p-0.75 max-mobile:w-full [&>button]:h-7 [&>button]:cursor-pointer [&>button]:whitespace-nowrap [&>button]:rounded-sm [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-2.5 [&>button]:text-xs [&>button]:font-medium [&>button]:text-muted-foreground [&>button:hover]:text-foreground [&>button[aria-pressed=true]]:bg-background [&>button[aria-pressed=true]]:text-foreground [&>button[aria-pressed=true]]:shadow-[var(--shadow-xs)] max-mobile:[&>button]:flex-1"
					aria-label="Direção da transação"
				>
					{(
						[
							["all", "Todos"],
							["income", "Entradas"],
							["expense", "Saídas"],
						] as const
					).map(([value, label]) => (
						<button
							aria-pressed={search.direction === value}
							key={value}
							onClick={() => onChange({ direction: value as TransactionDirection })}
							type="button"
						>
							{label}
						</button>
					))}
				</div>
			</div>
		</section>
	);
}

export function TransactionMetrics({
	loading,
	summary,
}: {
	loading: boolean;
	summary?: FinanceTransactionsSummary;
}) {
	return (
		<section
			className="mb-4.5 grid grid-cols-2 gap-3 max-mobile:grid-cols-1 [&>article]:flex [&>article]:min-w-0 [&>article]:items-start [&>article]:gap-3 [&>article]:rounded-lg [&>article]:border [&>article]:border-border [&>article]:bg-card [&>article]:p-4 [&>article>div]:grid [&>article>div]:min-w-0 [&>article>div]:gap-1 [&_p]:m-0 [&_p]:text-xs [&_p]:text-muted-foreground [&_strong]:text-[clamp(19px,2.2vw,24px)] [&_strong]:font-semibold [&_strong]:tracking-[-0.025em] [&_strong]:tabular-nums [&_small]:text-[11px] [&_small]:text-muted-foreground"
			aria-label="Totais no período"
		>
			<article>
				<span className="grid size-8.5 shrink-0 place-items-center rounded-md border border-[color-mix(in_oklab,var(--positive)_22%,transparent)] bg-[color-mix(in_oklab,var(--positive)_12%,transparent)] text-positive">
					<ArrowUpRight size={17} />
				</span>
				<div>
					<p>Total de entradas</p>
					<strong>
						{loading ? "—" : formatMoney(summary?.received, summary?.currency)}
					</strong>
					<small>Transferências próprias não entram no total</small>
				</div>
			</article>
			<article>
				<span className="grid size-8.5 shrink-0 place-items-center rounded-md border border-[color-mix(in_oklab,var(--negative)_20%,transparent)] bg-[color-mix(in_oklab,var(--negative)_10%,transparent)] text-negative">
					<ArrowDownRight size={17} />
				</span>
				<div>
					<p>Total de saídas</p>
					<strong>
						{loading ? "—" : formatMoney(summary?.spent, summary?.currency)}
					</strong>
					<small>{summary?.accountsCovered ?? 0} contas consideradas</small>
				</div>
			</article>
		</section>
	);
}

interface LedgerProps {
	accounts: FinanceAccount[];
	canLoadMore: boolean;
	groups: { date: string; transactions: FinanceTransaction[] }[];
	loading: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
	summary?: FinanceTransactionsSummary;
}

const detailLabel = (value: string) => value.replaceAll("_", " ").toLocaleLowerCase("pt-BR");

function TransactionDetails({
	account,
	transaction,
}: {
	account?: FinanceAccount;
	transaction: FinanceTransaction;
}) {
	const details = transaction;
	const rows = [
		{ label: "Conta", value: account ? `${account.name} · ${account.institution}` : undefined },
		{
			label: "Data e hora",
			value: details.occurredAt
				? dateTimeFormat.format(new Date(details.occurredAt))
				: undefined,
		},
		{ label: "Descrição original", value: details.description },
		{
			label: "Contraparte",
			value: details.counterparty?.name,
			hint: details.counterparty?.document,
		},
		{
			label: "Categoria",
			value: details.category
				? (CATEGORY_LABELS[details.category] ?? details.category)
				: "Sem categoria",
			hint: details.categorySrc === "pluggy" ? "Categorizada pelo Pluggy" : undefined,
		},
		{
			label: "Forma de pagamento",
			value: details.paymentMethod ? detailLabel(details.paymentMethod) : undefined,
		},
		{
			label: "Parcela",
			value: details.instalment?.number
				? `${details.instalment.number}${details.instalment.total ? ` de ${details.instalment.total}` : ""}`
				: undefined,
		},
		{
			label: "Data da compra",
			value: details.purchaseDate
				? rangeFormat.format(localDate(details.purchaseDate.slice(0, 10)))
				: undefined,
		},
		{
			label: "Valor original",
			value: details.original
				? formatMoney(details.original.amount, details.original.currency)
				: undefined,
		},
		{ label: "MCC", value: details.mcc ?? undefined },
		{ label: "Fatura", value: details.billId ?? undefined },
		{ label: "ID da transação", value: details.id },
	].filter(({ value }) => value);

	return (
		<div
			className="grid grid-cols-3 gap-x-6 gap-y-3.5 border-t border-border bg-[color-mix(in_oklab,var(--secondary)_62%,var(--card))] px-16 pt-4 pb-4.5 max-shell:grid-cols-2 max-shell:px-13.5 max-mobile:grid-cols-1 max-mobile:px-13 max-mobile:pt-3.5 max-mobile:pb-4 [&>div]:grid [&>div]:min-w-0 [&>div]:content-start [&>div]:gap-0.75 [&>div>span]:text-[10px] [&>div>span]:font-medium [&>div>span]:tracking-[0.04em] [&>div>span]:text-muted-foreground [&>div>span]:uppercase [&>div>small]:text-[10px] [&>div>small]:text-muted-foreground [&>div>strong]:text-xs [&>div>strong]:font-medium [&>div>strong]:[overflow-wrap:anywhere]"
			id={`transaction-details-${transaction.id}`}
		>
			<header className="col-span-full flex items-center gap-1 border-b border-border pb-2.5">
				<strong className="truncate text-xs font-semibold">
					{transaction.description ?? transaction.descriptionNorm}
				</strong>
				<CopyButton
					label="Copiar JSON da transação"
					value={JSON.stringify(transaction, null, 2)}
				/>
			</header>
			{rows.map(({ hint, label, value }) => (
				<div key={label}>
					<span>{label}</span>
					<strong>{value}</strong>
					{hint ? <small>{hint}</small> : null}
				</div>
			))}
		</div>
	);
}

function TransactionRow({
	account,
	expanded,
	onToggle,
	transaction,
}: {
	account?: FinanceAccount;
	expanded: boolean;
	onToggle: () => void;
	transaction: FinanceTransaction;
}) {
	const income = Number(transaction.amount) >= 0;
	return (
		<article className="group/transaction [&+&]:border-t [&+&]:border-border">
			<button
				aria-controls={`transaction-details-${transaction.id}`}
				aria-expanded={expanded}
				className="grid min-h-16 w-full cursor-pointer grid-cols-[32px_minmax(220px,1.7fr)_minmax(130px,0.85fr)_minmax(150px,0.9fr)_auto] items-center gap-3 border-0 bg-transparent px-3.5 py-2.5 text-left text-xs text-inherit hover:bg-[color-mix(in_oklab,var(--accent)_55%,transparent)] focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-expanded:bg-[color-mix(in_oklab,var(--accent)_55%,transparent)] max-wide:grid-cols-[32px_minmax(190px,1.5fr)_minmax(120px,0.8fr)_minmax(130px,0.8fr)_auto] max-shell:grid-cols-[32px_minmax(0,1fr)_auto] max-shell:gap-x-2.5 max-shell:gap-y-2 max-shell:px-3 max-shell:py-2.75 max-shell:[&>b]:col-start-3 max-shell:[&>b]:row-start-1"
				onClick={onToggle}
				type="button"
			>
				<span
					className={`grid size-7.5 shrink-0 place-items-center rounded-md border max-shell:row-span-3 ${income ? "border-[color-mix(in_oklab,var(--positive)_22%,transparent)] bg-[color-mix(in_oklab,var(--positive)_12%,transparent)] text-positive" : "border-[color-mix(in_oklab,var(--negative)_20%,transparent)] bg-[color-mix(in_oklab,var(--negative)_10%,transparent)] text-negative"}`}
				>
					{income ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
				</span>
				<span className="grid min-w-0 gap-0.5 max-shell:col-start-2">
					<strong className="truncate font-medium">
						{transaction.description ?? transaction.descriptionNorm}
					</strong>
					{transaction.counterparty?.name ? (
						<small className="truncate text-[11px] text-muted-foreground">
							{transaction.counterparty.name}
						</small>
					) : null}
				</span>
				<span className="w-fit max-w-full truncate rounded-full border border-border bg-secondary px-1.75 py-0.75 text-[10px] text-muted-foreground max-shell:col-start-2 max-shell:row-start-2 max-mobile:max-w-[min(100%,180px)]">
					{transaction.category
						? (CATEGORY_LABELS[transaction.category] ?? transaction.category)
						: "Sem categoria"}
				</span>
				<span className="grid min-w-0 gap-0.5 max-shell:col-start-2 max-shell:row-start-3">
					<strong className="truncate font-medium">
						{account?.name ?? "Conta não identificada"}
					</strong>
					<small className="truncate text-[11px] text-muted-foreground max-mobile:hidden">
						{account?.institution}
					</small>
				</span>
				<b
					className={`whitespace-nowrap text-right text-[11px] font-semibold tabular-nums ${income ? "text-positive" : "text-negative"}`}
				>
					{formatMoney(transaction.amount, transaction.currency ?? account?.currency)}
				</b>
			</button>
			{expanded ? <TransactionDetails account={account} transaction={transaction} /> : null}
		</article>
	);
}

export function TransactionLedger({
	accounts,
	canLoadMore,
	groups,
	loading,
	loadingMore,
	onLoadMore,
	summary,
}: LedgerProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const accountsById = useMemo(
		() => new Map(accounts.map((account) => [account.id, account])),
		[accounts],
	);
	const daysByDate = useMemo(
		() => new Map(summary?.days.map((day) => [day.date, day])),
		[summary],
	);
	return (
		<section
			className="overflow-hidden rounded-lg border border-border bg-card"
			aria-label="Transações por dia"
		>
			{groups.length === 0 && !loading ? (
				<p className="m-0 px-5 py-8 text-center text-xs text-muted-foreground">
					{canLoadMore
						? "Nenhuma transação correspondente nas páginas carregadas."
						: "Nenhuma transação encontrada para estes filtros."}
				</p>
			) : null}
			{groups.map((group) => {
				const totals = daysByDate.get(group.date);
				return (
					<section
						className="bg-transparent [&+&]:border-t [&+&]:border-border"
						key={group.date}
					>
						<header className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-secondary px-3.5 py-2.5 max-mobile:items-start max-mobile:flex-col max-mobile:gap-2">
							<div className="flex items-center gap-2.5">
								<span className="grid size-7.5 place-items-center rounded-md border border-border bg-card text-muted-foreground">
									<CalendarDays size={15} />
								</span>
								<div className="grid gap-0.5">
									<strong className="text-[13px] font-semibold">
										{formatDay(group.date)}
									</strong>
									<small className="text-[11px] text-muted-foreground">
										{totals?.count ?? group.transactions.length} lançamentos
									</small>
								</div>
							</div>
							<div className="flex items-center gap-3.5 text-[11px] tabular-nums max-mobile:w-full max-mobile:justify-between max-mobile:pl-10 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1">
								<span className="text-positive">
									<ArrowUpRight size={13} />{" "}
									{formatMoney(totals?.received, summary?.currency)}
								</span>
								<span className="text-negative">
									<ArrowDownRight size={13} />{" "}
									{formatMoney(totals?.spent, summary?.currency)}
								</span>
							</div>
						</header>
						<div>
							{group.transactions.map((transaction) => (
								<TransactionRow
									account={
										transaction.accountId
											? accountsById.get(transaction.accountId)
											: undefined
									}
									expanded={expandedId === transaction.id}
									key={transaction.id}
									onToggle={() =>
										setExpandedId((current) =>
											current === transaction.id ? null : transaction.id,
										)
									}
									transaction={transaction}
								/>
							))}
						</div>
					</section>
				);
			})}
			{canLoadMore ? (
				<div className="flex justify-center border-t border-border p-3">
					<button
						className={buttonClass({ variant: "secondary" })}
						disabled={loadingMore}
						onClick={onLoadMore}
						type="button"
					>
						{loadingMore ? <LoaderCircle className="animate-spin" size={14} /> : null}
						{loadingMore ? "Carregando…" : "Carregar mais transações"}
					</button>
				</div>
			) : null}
		</section>
	);
}
