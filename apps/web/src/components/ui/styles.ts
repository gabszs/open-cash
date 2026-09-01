import { cn } from "@/lib/classNames";

const buttonBase =
	"inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-xs)] transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_90%,transparent)] disabled:pointer-events-none disabled:opacity-50";

const buttonVariants = {
	primary: "",
	secondary: "border-border bg-secondary text-foreground hover:bg-accent",
	outline: "border-border bg-transparent text-foreground hover:bg-accent",
	ghost: "bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground",
	danger: "border-[color-mix(in_oklab,var(--destructive)_40%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_20%,transparent)] text-foreground hover:bg-[color-mix(in_oklab,var(--destructive)_30%,transparent)]",
} as const;

const buttonSizes = {
	default: "",
	sm: "h-7 gap-1.5 px-2.5 text-[13px]",
} as const;

export function buttonClass({
	variant = "primary",
	size = "default",
	full = false,
	className,
}: {
	variant?: keyof typeof buttonVariants;
	size?: keyof typeof buttonSizes;
	full?: boolean;
	className?: string;
} = {}) {
	return cn(buttonBase, buttonVariants[variant], buttonSizes[size], full && "w-full", className);
}

const iconButtonBase =
	"inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

const iconButtonVariants = {
	ghost: "",
	outline: "border-border",
	danger: "hover:bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)] hover:text-destructive",
} as const;

const iconButtonSizes = {
	default: "",
	xs: "size-6",
	md: "size-8",
} as const;

export function iconButtonClass({
	variant = "ghost",
	size = "default",
	active = false,
	className,
}: {
	variant?: keyof typeof iconButtonVariants;
	size?: keyof typeof iconButtonSizes;
	active?: boolean;
	className?: string;
} = {}) {
	return cn(
		iconButtonBase,
		iconButtonVariants[variant],
		iconButtonSizes[size],
		active && "border-sidebar-border bg-sidebar-accent text-foreground",
		className,
	);
}

export const inputClass =
	"min-w-0 rounded-md border border-border bg-input px-2.5 py-2 text-sm text-foreground shadow-[var(--shadow-xs)] outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50";

export const eyebrowClass =
	"mb-1.5 font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase";

export const badgeClass =
	"inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium not-italic text-muted-foreground";

export const pageClass = "flex min-w-0 flex-1 flex-col overflow-hidden bg-background";
export const pageScrollClass = "flex-1 overflow-y-auto";
export const pageContentClass =
	"mx-auto w-full max-w-[1180px] px-8 pt-8 pb-16 max-shell:px-5 max-shell:pt-7 max-shell:pb-14 max-mobile:px-3.5 max-mobile:pt-6 max-mobile:pb-12";

export const panelClass = "rounded-lg border border-border bg-card";

export const fieldClass = "grid gap-2 text-sm";
export const fieldLabelClass = "flex items-center gap-1.5 text-foreground";
export const fieldGridClass = "grid grid-cols-2 gap-3 max-mobile:grid-cols-1";
export const settingsSectionClass = "flex w-full flex-col gap-3";
export const settingsActionsClass = "flex items-center justify-end gap-2";

export const listCardClass =
	"grid w-full overflow-hidden rounded-lg border border-border bg-card [&>article]:grid [&>article]:grid-cols-[28px_minmax(0,1fr)_auto] [&>article]:items-center [&>article]:gap-2.5 [&>article]:px-3 [&>article]:py-2.5 [&>article+article]:border-t [&>article+article]:border-border";
export const listIconClass =
	"grid size-7 place-items-center rounded-md border border-border bg-secondary text-muted-foreground";
export const listContentClass =
	"grid min-w-0 gap-0.5 [&>strong]:overflow-hidden [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>strong]:text-[13px] [&>strong]:font-medium [&>small]:flex [&>small]:items-center [&>small]:gap-1 [&>small]:overflow-hidden [&>small]:text-ellipsis [&>small]:whitespace-nowrap [&>small]:text-xs [&>small]:text-muted-foreground";
export const listActionsClass = "flex items-center gap-1.5";
export const listTriggerClass =
	"group/trigger grid min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit [&>div]:grid [&>div]:min-w-0 [&>div]:gap-0.5 [&_strong]:group-hover/trigger:underline [&_strong]:group-hover/trigger:decoration-border [&_strong]:group-hover/trigger:underline-offset-[3px]";
export const listRowEditClass = "grid min-w-0 gap-1.5";
export const listEmptyClass = "p-3 text-[13px] text-muted-foreground";

export const calloutClass =
	"flex w-full items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-xs leading-[1.55] text-muted-foreground [&>svg]:mt-px [&>svg]:shrink-0 [&_code]:text-foreground [&_div]:grid [&_div]:gap-0.5 [&_p]:m-0 [&_strong]:text-[13px] [&_strong]:font-medium [&_strong]:text-foreground";
export const secretBlockClass =
	"grid w-full gap-2 rounded-lg border border-border bg-secondary p-3 text-xs [&>code]:text-brand [&>code]:[overflow-wrap:anywhere] [&_strong]:text-xs [&_strong]:font-medium";

// Opaque `--popover` on purpose: the menu floats over pages with different
// surfaces, and a token tied to the sidebar made it read as a different color
// depending on what sat behind it.
export const menuClass =
	"flex min-w-50 animate-pop-in flex-col gap-0.5 rounded-lg border border-sidebar-border bg-popover p-1 shadow-[var(--shadow-lg)]";
export const menuItemClass =
	"flex h-7 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-border hover:text-foreground focus-visible:bg-sidebar-border focus-visible:text-foreground data-[open=true]:bg-sidebar-border data-[open=true]:text-foreground data-[selected=true]:text-foreground [&>svg]:shrink-0";
export const menuLabelClass = "flex-1 truncate";
// Inset by `mx-2`, which lands the rule at the same 12px as an item's icon
// (menu `p-1` + item `px-2`) instead of running edge to edge.
export const menuSeparatorClass = "mx-2 my-1 h-px shrink-0 bg-sidebar-border";
export const kbdClass =
	"inline-flex h-5 items-center rounded-sm border border-b-2 border-sidebar-border bg-gradient-to-t from-sidebar-accent to-transparent px-1 text-[11px] leading-none";

export const centeredPageClass =
	"grid min-h-full flex-1 place-items-center bg-background px-5 py-8";
export const emptyStateClass =
	"grid justify-items-center gap-1.5 text-center [&_h1]:text-xl [&_h1]:font-semibold [&_p]:text-[13px] [&_p]:text-muted-foreground";
export const emptyPanelClass =
	"grid place-items-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-[13px] text-muted-foreground";
export const pageStateClass =
	"mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-[13px] text-muted-foreground";
export const authCardClass =
	"grid w-full max-w-[400px] gap-4.5 [&>div>h1]:mb-1.5 [&>div>h1]:text-[22px] [&>div>h1]:font-semibold [&>div>h1]:tracking-[-0.02em] [&>div>p:last-child]:mb-0 [&>div>p:last-child]:text-[13px] [&>div>p:last-child]:leading-[1.55] [&>div>p:last-child]:text-muted-foreground [&>label]:grid [&>label]:gap-2 [&>label]:text-[13px]";
