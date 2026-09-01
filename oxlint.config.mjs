import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";

export default defineConfig({
	extends: [core, react, tanstack],
	// `src/sandboxes/` holds Flue blueprint adapters kept verbatim so
	// `flue update sandbox <name>` can diff against the published version.
	// Autofixing them rewrites vendor API literals (e.g. `"utf8"` → `"utf-8"`).
	ignorePatterns: [...core.ignorePatterns, "**/src/sandboxes/**"],
	rules: {
		curly: ["error", "multi-line"],
		"eslint/func-style": "off",
		"no-inline-comments": "off",
		"no-useless-return": "off",
		"node/callback-return": "off",
		"prefer-await-to-callbacks": "off",
		"promise/prefer-await-to-then": "off",
		// `DO\.ts$` keeps the Durable Object acronym in filenames
		// (`identityDO.ts`, `userIdentityDO.ts`) matching the exported class name.
		"unicorn/filename-case": [
			"error",
			{
				case: "camelCase",
				ignore: ["^I[A-Z]", "/test/", "/test", "^global-setup\\.ts$", "DO\\.ts$"],
			},
		],
		"require-await": "off",
		"sort-keys": "off",
		"method-signature-style": "off",
		"class-methods-use-this": "off",
	},
});
