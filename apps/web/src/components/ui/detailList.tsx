import type { ReactNode } from "react";

export interface DetailItem {
	label: string;
	value: ReactNode;
}

/** Label/value grid revealed when a list row is expanded. */
export function DetailList({ items }: { items: DetailItem[] }) {
	return (
		<dl className="col-span-full m-0 grid gap-1.5 border-t border-dashed border-border pt-2.5">
			{items.map((item) => (
				<div
					className="grid grid-cols-[132px_minmax(0,1fr)] gap-2.5 text-xs"
					key={item.label}
				>
					<dt className="text-muted-foreground">{item.label}</dt>
					<dd className="m-0 [overflow-wrap:anywhere] whitespace-normal">
						{item.value ?? "—"}
					</dd>
				</div>
			))}
		</dl>
	);
}
