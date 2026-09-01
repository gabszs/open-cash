import type { ReactNode } from "react";

import { settingsSectionClass } from "@/components/ui/styles";

export function SettingsSection({
	title,
	description,
	action,
	children,
}: {
	title?: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<section className={settingsSectionClass}>
			{/* The wrapper keeps title and description stacked while `action` takes the
			    header's second column. */}
			<header className="relative flex items-center justify-between gap-2.5">
				<div className="grid min-w-0 gap-0.5">
					{title ? <strong className="text-sm font-medium">{title}</strong> : null}
					{description ? (
						<small className="text-xs leading-4.5 text-muted-foreground">
							{description}
						</small>
					) : null}
				</div>
				{action}
			</header>
			{children}
		</section>
	);
}
