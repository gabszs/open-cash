/**
 * Boolean control for settings rows. `label` is required because the switch
 * replaces text badges, leaving no visible state description.
 */
export function Switch({
	checked,
	onChange,
	label,
	disabled = false,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
	disabled?: boolean;
}) {
	return (
		<button
			className="flex h-5 w-[34px] shrink-0 cursor-pointer items-center rounded-full border border-border bg-secondary p-0.5 transition-colors data-[checked=true]:border-[color-mix(in_oklab,var(--brand)_45%,transparent)] data-[checked=true]:bg-[color-mix(in_oklab,var(--brand)_22%,transparent)] disabled:pointer-events-none disabled:opacity-50"
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			data-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
		>
			<span className="size-3.5 rounded-full bg-muted-foreground transition-[transform,background] duration-150 ease-[var(--ease-out-quart)] [[data-checked=true]>&]:translate-x-3.5 [[data-checked=true]>&]:bg-brand" />
		</button>
	);
}
