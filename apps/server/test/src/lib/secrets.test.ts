import { describe, expect, test } from "bun:test";

import { seal, unseal } from "../../../src/lib/secrets";

describe("finance credential sealing", () => {
	test("round trips without storing the plaintext", async () => {
		const sealed = await seal("client-secret", "encryption-key");
		expect(sealed).not.toContain("client-secret");
		expect(await unseal(sealed, "encryption-key")).toBe("client-secret");
	});

	test("rejects a different encryption key", async () => {
		const sealed = await seal("client-secret", "first-key");
		expect(unseal(sealed, "second-key")).rejects.toBeInstanceOf(Error);
	});
});
