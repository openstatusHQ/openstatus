import { connect } from "node:tls";

const PROBE_TIMEOUT_MS = 5_000;

/** Whether `domain:443` serves a certificate that validates for `domain`. */
export function hasTrustedCertificate(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({
      host: domain,
      port: 443,
      servername: domain,
      // Read `authorized` ourselves so an untrusted cert resolves false instead of erroring.
      rejectUnauthorized: false,
      timeout: PROBE_TIMEOUT_MS,
    });
    const done = (trusted: boolean) => {
      socket.destroy();
      resolve(trusted);
    };
    socket.once("secureConnect", () => done(socket.authorized));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}
