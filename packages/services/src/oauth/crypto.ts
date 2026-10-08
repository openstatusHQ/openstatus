// Web Crypto only: this package runs on Deno and stays Edge-safe.

const encoder = new TextEncoder();

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomBase64Url(length = 32): string {
  return toBase64Url(randomBytes(length));
}

export function randomHex(length = 16): string {
  return toHex(randomBytes(length));
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return new Uint8Array(digest);
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await sha256(input));
}

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(code_verifier))). */
export async function pkceChallenge(verifier: string): Promise<string> {
  return toBase64Url(await sha256(verifier));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

export async function verifyPkce(
  verifier: string,
  challenge: string,
): Promise<boolean> {
  if (!VERIFIER_RE.test(verifier)) return false;
  return constantTimeEqual(await pkceChallenge(verifier), challenge);
}
