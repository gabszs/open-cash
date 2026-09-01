import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
	extends: [ultracite],
	// TanStack Router rewrites `routeTree.gen.ts` in its own style on every route
	// change, so formatting it only starts a fight with the running dev server —
	// the file's own header asks to be excluded from linters and formatters.
	ignorePatterns: [...ultracite.ignorePatterns, "**/src/routeTree.gen.ts"],
	sortImports: {
		groups: [
			"type-import",
			["value-builtin", "value-external"],
			"type-internal",
			"value-internal",
			["type-parent", "type-sibling", "type-index"],
			["value-parent", "value-sibling", "value-index"],
			"unknown",
		],
	},
	tabWidth: 4,
	useTabs: true,
});
