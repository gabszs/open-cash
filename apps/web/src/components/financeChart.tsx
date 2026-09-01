interface ChartData {
	title: string;
	type: "bar" | "line" | "donut" | "area";
	description?: string;
	series: {
		name: string;
		color?: string;
		data: { label: string; value: number }[];
	}[];
}

export function FinanceChart({ chart }: { chart: ChartData }) {
	const values = chart.series.flatMap((series) =>
		series.data.map((point) => Math.abs(point.value)),
	);
	const max = Math.max(...values, 1);
	return (
		<section className="rounded-lg border border-border bg-card p-3.5">
			<header className="flex items-start justify-between gap-3">
				<div className="grid gap-0.5">
					<strong className="font-medium">{chart.title}</strong>
					{chart.description ? (
						<small className="text-xs text-muted-foreground">{chart.description}</small>
					) : null}
				</div>
				<span className="font-mono text-[11px] text-muted-foreground">{chart.type}</span>
			</header>
			<div className="flex h-[180px] items-end gap-2 pt-6">
				{chart.series[0]?.data.map((point) => (
					<div
						className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
						key={point.label}
					>
						<span
							className="w-[min(100%,32px)] min-h-1 rounded-t-sm rounded-b-[2px] bg-brand"
							style={{
								height: `${Math.max(5, (Math.abs(point.value) / max) * 100)}%`,
								background: chart.series[0]?.color,
							}}
						/>
						<small className="max-w-[70px] truncate text-[10px] text-muted-foreground">
							{point.label}
						</small>
					</div>
				))}
			</div>
		</section>
	);
}
