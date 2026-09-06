export type Credential = {
  token: string;
  source: "x-openstatus-key" | "bearer";
};

export const MISSING_CREDENTIALS_MESSAGE =
  "Missing credentials: send an 'x-openstatus-key' header or 'Authorization: Bearer <token>'";

/** `x-openstatus-key` wins over `Authorization: Bearer`; both surfaces share this order. */
export function extractCredential(headers: {
  get(name: string): string | null | undefined;
}): Credential | null {
  const key = headers.get("x-openstatus-key");
  if (key) return { token: key, source: "x-openstatus-key" };

  const authorization = headers.get("authorization");
  if (authorization) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
    if (match?.[1]) return { token: match[1], source: "bearer" };
  }
  return null;
}
