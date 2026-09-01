import { describe, expect, it } from "vitest";

import { FINANCE_CAPABILITIES } from "../../../../src/features/finance/common/contracts";
import { requestApp } from "../../../helpers/http";

describe("finance HTTP and OpenAPI contract", () => {
	it("rejects every finance operation without authentication", async () => {
		const response = await requestApp("/v1/finance/accounts");
		expect(response.status).toBe(401);
		await response.text();
	});

	it("publishes one concrete OpenAPI route for every MCP capability", async () => {
		const response = await requestApp("/open-api.json");
		expect(response.status).toBe(200);
		const document = await response.json<{ paths: Record<string, Record<string, unknown>> }>();
		for (const capability of FINANCE_CAPABILITIES) {
			const path = Object.keys(document.paths).find((candidate) =>
				candidate.endsWith(capability.route),
			);
			expect(path, `${capability.tool} route`).toBeDefined();
			expect(document.paths[path ?? ""]?.[capability.method.toLowerCase()]).toBeDefined();
		}
	});
});
