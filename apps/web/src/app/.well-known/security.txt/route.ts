// security.txt — RFC 9116.
// `Expires` is computed on every request as (now + 90 days) so the file can
// never go stale: as long as the site is being deployed and served, the value
// is fresh. RFC 9116 requires Expires <= 1 year; 90 days is well within that.

const EXPIRY_DAYS = 90;

export const dynamic = "force-dynamic";

export function GET() {
  const expires = new Date(
    Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const body = [
    "# Openstatus security contact — RFC 9116",
    "Contact: mailto:ping@openstatus.dev",
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    "Canonical: https://www.openstatus.dev/.well-known/security.txt",
    "Policy: https://github.com/openstatusHQ/openstatus/security/policy",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
