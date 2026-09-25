import { lookup } from "node:dns/promises";
import { connect } from "node:tls";

import { assertSafeUrlSync } from "@openstatus/utils";

const PROBE_TIMEOUT_MS = 5_000;

/** Whether `domain:443` serves a certificate that validates for `domain`. */
export async function hasTrustedCertificate(domain: string): Promise<boolean> {
  let address: string;
  try {
    // Custom domains on Vercel are IPv4-only (A/CNAME records).
    ({ address } = await lookup(domain, { family: 4 }));
    assertSafeUrlSync(`https://${address}`);
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    // Connect to the checked address so a second lookup can't be rebound to
    // an internal host; `servername` still drives SNI and hostname validation.
    const socket = connect({
      host: address,
      port: 443,
      servername: domain,
      timeout: PROBE_TIMEOUT_MS,
    });
    const done = (trusted: boolean) => {
      socket.destroy();
      resolve(trusted);
    };
    socket.once("secureConnect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}
