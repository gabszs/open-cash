import type { Components } from "react-markdown";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Styling is per-element rather than a typography plugin so the transcript keeps
 * the same 14px/1.7 rhythm as the rest of the chat. Defined once, outside the
 * component, so a re-render on every streamed delta does not remount the tree.
 */
const components: Components = {
	p: ({ children }) => <p className="my-2">{children}</p>,
	ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
	ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
	li: ({ children }) => <li className="pl-0.5">{children}</li>,
	strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
	em: ({ children }) => <em className="italic">{children}</em>,
	hr: () => <hr className="my-4 border-border" />,
	blockquote: ({ children }) => (
		<blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
			{children}
		</blockquote>
	),
	h1: ({ children }) => <h1 className="mt-4 mb-2 text-[17px] font-semibold">{children}</h1>,
	h2: ({ children }) => <h2 className="mt-4 mb-2 text-[16px] font-semibold">{children}</h2>,
	h3: ({ children }) => <h3 className="mt-3 mb-2 text-[15px] font-semibold">{children}</h3>,
	h4: ({ children }) => <h4 className="mt-3 mb-2 text-sm font-semibold">{children}</h4>,
	a: ({ children, href }) => (
		<a
			className="text-brand underline underline-offset-2"
			href={href}
			target="_blank"
			rel="noreferrer"
		>
			{children}
		</a>
	),
	code: ({ children }) => (
		<code className="rounded-sm bg-secondary px-1 py-0.5 font-mono text-[13px] group-[.is-block]:bg-transparent group-[.is-block]:p-0">
			{children}
		</code>
	),
	pre: ({ children }) => (
		<pre className="group is-block my-2 overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-[13px] leading-6">
			{children}
		</pre>
	),
	table: ({ children }) => (
		<div className="my-2 overflow-x-auto">
			<table className="w-full border-collapse text-[13px] [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-secondary [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium">
				{children}
			</table>
		</div>
	),
};

const plugins = [remarkGfm];

/**
 * Assistant text arrives as markdown. `remark-gfm` covers the tables and strike
 * the model actually emits; raw HTML is deliberately not enabled — nothing the
 * model writes should reach the DOM as markup.
 *
 * Memoised on the string: a parse is the most expensive thing the transcript
 * does, and a streaming turn re-renders every settled message alongside the one
 * that changed.
 */
export const Markdown = memo(({ children }: { children: string }) => (
	<div className="min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
		<ReactMarkdown remarkPlugins={plugins} components={components}>
			{children}
		</ReactMarkdown>
	</div>
));

Markdown.displayName = "Markdown";
