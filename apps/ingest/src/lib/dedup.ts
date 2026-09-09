const encoder = new TextEncoder();

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fingerprintFor(
  alertSourceId: number,
  groupKey: string,
): Promise<string> {
  return sha256(`${alertSourceId}:${groupKey}`);
}

/**
 * Exact when the provider supplies its own event id. Without one it degrades to
 * a coarse time bucket, which is a heuristic: two genuinely distinct alerts with
 * the same group key and status inside the bucket collapse into one.
 *
 * `statusKey` is never optional. Alertmanager reuses one per-alert fingerprint
 * for both the firing and the resolved delivery, so keying on the event id alone
 * would treat a resolution as a duplicate of the alert it closes and drop it.
 */
export function dedupKeyFor(args: {
  alertSourceId: number;
  externalId: string | null;
  fingerprint: string | null;
  statusKey: string;
  rawBody: string;
  bucketSeconds?: number;
  now?: number;
}): Promise<string> {
  const { alertSourceId, externalId, fingerprint, statusKey, rawBody } = args;
  if (externalId) {
    return sha256(`${alertSourceId}:id:${externalId}:${statusKey}`);
  }
  if (fingerprint) {
    const bucket = Math.floor(
      (args.now ?? Date.now()) / 1000 / (args.bucketSeconds ?? 60),
    );
    return sha256(`${alertSourceId}:fp:${fingerprint}:${statusKey}:${bucket}`);
  }
  return sha256(`${alertSourceId}:body:${rawBody}`);
}
