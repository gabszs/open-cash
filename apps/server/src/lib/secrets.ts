const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCodePoint(...bytes));
const fromBase64 = (value: string) =>
	Uint8Array.from(atob(value), (character) => character.codePointAt(0) ?? 0);

async function key(secret: string) {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
	return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(value: string, secret: string) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		await key(secret),
		encoder.encode(value),
	);
	return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function unseal(value: string, secret: string) {
	const [encodedIv, encodedPayload] = value.split(".");
	if (!encodedIv || !encodedPayload) throw new Error("Invalid sealed finance credential");
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: fromBase64(encodedIv) },
		await key(secret),
		fromBase64(encodedPayload),
	);
	return decoder.decode(decrypted);
}
