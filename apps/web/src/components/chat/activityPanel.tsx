import type { FlueConversationPart } from "@flue/react";
import type { LucideIcon } from "lucide-react";

import { ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";
import { memo, useState } from "react";

import { CopyButton } from "@/components/chat/copyButton";
import { Markdown } from "@/components/chat/markdown";
import { describeTool, formatDuration, reasoningLabel } from "@/components/chat/toolCatalog";

export type ActivityPart = Extract<
	FlueConversationPart,
	{ type: "reasoning" } | { type: "dynamic-tool" }
>;

export function isActivityPart(part: FlueConversationPart): part is ActivityPart {
	return part.type === "reasoning" || part.type === "dynamic-tool";
}

function isRunning(part: ActivityPart) {
	return part.type === "reasoning"
		? part.state === "streaming"
		: part.state === "input-available";
}

function labelFor(part: ActivityPart) {
	return part.type === "reasoning" ? reasoningLabel : describeTool(part.toolName);
}

function runningHeadline(parts: ActivityPart[]) {
	const current = [...parts].toReversed().find(isRunning) ?? parts.at(-1);
	return current ? `${labelFor(current).running}…` : "Trabalhando…";
}

/**
 * The coarse bucket a step is counted under in the collapsed headline. Which
 * tool ran belongs in the step row, not in the summary line — naming them there
 * turns the headline into a wall of tool names.
 */
function bucketFor(part: ActivityPart) {
	if (part.type === "reasoning") return "Raciocínio";
	if (part.toolName.endsWith("render_finance_chart")) return "Gráficos";
	if (
		part.toolName.endsWith("create_finance_file") ||
		part.toolName.endsWith("open_file") ||
		part.toolName.endsWith("publish_file")
	) {
		return "Arquivos";
	}
	return "Ações";
}

/**
 * `Raciocínio 4x, Ações 2x, Gráficos` — the steps counted by kind, in the order
 * the agent took them, so a collapsed panel still says what happened.
 */
function settledHeadline(parts: ActivityPart[]) {
	const counts = new Map<string, number>();
	for (const part of parts) {
		const group = bucketFor(part);
		counts.set(group, (counts.get(group) ?? 0) + 1);
	}
	return [...counts]
		.map(([group, count]) => (count > 1 ? `${group} ${count}x` : group))
		.join(", ");
}

function stepKey(part: ActivityPart, index: number) {
	return part.type === "dynamic-tool" ? part.toolCallId : `reasoning-${index}`;
}

const PAYLOAD_LIMIT = 2000;

function safeJson(value: unknown) {
	try {
		return JSON.stringify(value, null, 2) ?? String(value);
	} catch {
		return String(value);
	}
}

/** Tool payloads can be megabytes of transactions; the panel shows the head. */
function stringify(value: unknown): string | null {
	if (value === undefined || value === null) return null;
	const text = typeof value === "string" ? value : safeJson(value);
	if (text.trim() === "") return null;
	return text.length > PAYLOAD_LIMIT ? `${text.slice(0, PAYLOAD_LIMIT)}…` : text;
}

/** Everything one step did, as plain text — what its copy button hands over. */
function stepText(part: ActivityPart) {
	if (part.type === "reasoning") return part.text;
	const lines = [describeTool(part.toolName).done, "", `Entrada: ${safeJson(part.input)}`];
	if (part.state === "output-available") lines.push("", `Resultado: ${safeJson(part.output)}`);
	if (part.state === "output-error") lines.push("", `Falha: ${part.errorText}`);
	return lines.join("\n");
}

function Payload({ label, value }: { label: string; value: unknown }) {
	const text = stringify(value);
	if (text === null) return null;
	return (
		<div className="group/payload grid gap-1">
			<div className="flex items-center justify-between gap-2">
				<span className="text-[11px] font-medium text-muted-foreground">{label}</span>
				<CopyButton
					value={text}
					label={`Copiar ${label.toLowerCase()}`}
					className="opacity-0 transition-opacity group-hover/payload:opacity-100 focus-visible:opacity-100"
				/>
			</div>
			<pre className="max-h-72 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-5 whitespace-pre-wrap">
				{text}
			</pre>
		</div>
	);
}

const ActivityStep = memo(({ part }: { part: ActivityPart }) => {
	// Errors open on arrival — a failed step is the one thing nobody should have
	// to click to see. Reasoning stays open while it streams, for the same reason
	// the panel does.
	const autoOpen =
		part.type === "reasoning" ? part.state === "streaming" : part.state === "output-error";
	const [override, setOverride] = useState<boolean | null>(null);
	const open = override ?? autoOpen;
	const label = labelFor(part);
	const running = isRunning(part);
	const Icon: LucideIcon = label.icon;

	return (
		// The copy button sits outside the <details>, pinned to the panel's right
		// edge: inside, it would ride the row's hover surface and shift with it.
		<div className="group/row flex w-full items-start gap-1">
			<details
				open={open}
				onToggle={(event) => setOverride(event.currentTarget.open)}
				className="group min-w-0 rounded-md open:w-full open:border open:border-border"
			>
				<summary className="flex w-full cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-card hover:text-foreground hover:shadow-[var(--shadow-sm)] group-open:text-foreground [&::-webkit-details-marker]:hidden">
					<Icon size={13} className="shrink-0" />
					<span className="truncate">{running ? `${label.running}…` : label.done}</span>
					{running ? (
						<LoaderCircle size={12} className="shrink-0 animate-spin text-brand" />
					) : null}
					{part.type === "dynamic-tool" && part.state === "output-error" ? (
						<TriangleAlert size={12} className="shrink-0 text-destructive" />
					) : null}
					{part.type === "dynamic-tool" && part.durationMs ? (
						<span className="shrink-0 font-mono text-[11px] tabular-nums">
							{formatDuration(part.durationMs)}
						</span>
					) : null}
					<ChevronDown
						size={12}
						className="shrink-0 transition-transform duration-150 group-open:rotate-180"
					/>
				</summary>
				<div className="grid gap-2 px-2 pt-1 pb-2">
					{part.type === "reasoning" ? (
						<div className="text-[13px] text-muted-foreground">
							{/* Enquanto streama, o texto cresce a cada delta e o painel está
							    aberto: parsear markdown aí custa o bloco inteiro por delta.
							    Só vale a pena quando o raciocínio assenta. */}
							{part.state === "streaming" ? (
								<p className="my-2 whitespace-pre-wrap">{part.text}</p>
							) : (
								<Markdown>{part.text}</Markdown>
							)}
						</div>
					) : (
						<>
							<span className="font-mono text-[11px] text-muted-foreground">
								{part.toolName}
							</span>
							<Payload label="Entrada" value={part.input} />
							{part.state === "output-available" ? (
								<Payload label="Resultado" value={part.output} />
							) : null}
							{part.state === "output-error" ? (
								<div className="grid gap-1">
									<span className="text-[11px] font-medium text-muted-foreground">
										Falha
									</span>
									<p className="text-[12px] text-destructive">{part.errorText}</p>
								</div>
							) : null}
						</>
					)}
				</div>
			</details>
			<CopyButton
				value={stepText(part)}
				label="Copiar etapa"
				className="mt-0.5 ml-auto opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
			/>
		</div>
	);
});

ActivityStep.displayName = "ActivityStep";

/**
 * One run of consecutive reasoning/tool parts, rendered as a single collapsible
 * panel — the agent's steps for that stretch of the turn.
 *
 * Collapsed it is only a line of muted text, so a finished turn reads as prose
 * with a footnote rather than as a box. While anything inside is still in
 * flight the panel forces itself open so the steps land in view as they stream,
 * then collapses on its own once the turn settles. A click flips `override`,
 * and from then on the reader's choice wins: a panel someone opened to read
 * must not slam shut when the next tool starts.
 */
export function ActivityPanel({ parts }: { parts: ActivityPart[] }) {
	const [override, setOverride] = useState<boolean | null>(null);
	const active = parts.some(isRunning);
	const open = override ?? active;

	const failures = parts.filter(
		(part) => part.type === "dynamic-tool" && part.state === "output-error",
	).length;
	const elapsed = parts.reduce(
		(total, part) => total + (part.type === "dynamic-tool" ? (part.durationMs ?? 0) : 0),
		0,
	);

	const headline = [
		active ? runningHeadline(parts) : settledHeadline(parts),
		elapsed > 0 && !active ? formatDuration(elapsed) : null,
		failures > 0 ? `${failures} ${failures === 1 ? "falha" : "falhas"}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="grid gap-2">
			<button
				type="button"
				onClick={() => setOverride(!open)}
				aria-expanded={open}
				// Explicitly transparent: Tailwind's preflight is off, so a bare
				// button would fall back to the browser's grey `buttonface`.
				className="flex w-fit max-w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				{active ? (
					<LoaderCircle size={13} className="shrink-0 animate-spin text-brand" />
				) : null}
				{failures > 0 && !active ? (
					<TriangleAlert size={13} className="shrink-0 text-destructive" />
				) : null}
				<span className="truncate">{headline}</span>
				<ChevronDown
					size={13}
					className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open ? (
				<div className="grid gap-0.5 rounded-lg border border-border p-1">
					{parts.map((part, index) => (
						<ActivityStep key={stepKey(part, index)} part={part} />
					))}
				</div>
			) : null}
		</div>
	);
}
