import { describe, expect, it } from "vitest";

import { createHonoTestClient } from "../../../helpers/http";

describe("utility routes", () => {
	it("returns the Worker health and version metadata", async () => {
		const response = await createHonoTestClient().health.$get();

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: expect.any(String),
			status: "ok",
			tag: expect.any(String),
			timestamp: expect.any(String),
		});
	});
});
