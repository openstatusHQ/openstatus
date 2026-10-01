import { EmailClient } from "@openstatus/emails";
import { resolveClientIp } from "@openstatus/services/page-access";
import { AuthError, type Profile } from "next-auth";
import type { OIDCConfig } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import WorkOS from "next-auth/providers/workos";

export const GitHubProvider = GitHub({
  allowDangerousEmailAccountLinking: true,
});

export const GoogleProvider = Google({
  allowDangerousEmailAccountLinking: true,
  authorization: {
    params: {
      // See https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
      prompt: "select_account",
      // scope:
      //   "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    },
  },
});

export const OIDCProvider: OIDCConfig<Profile> = {
  id: "oidc",
  name: process.env.AUTH_OIDC_NAME ?? "SSO",
  type: "oidc",
  issuer: process.env.AUTH_OIDC_ISSUER,
  clientId: process.env.AUTH_OIDC_ID,
  clientSecret: process.env.AUTH_OIDC_SECRET,
  checks: ["pkce", "state"],
};

// The stock provider bakes an empty `connection=` into the authorize URL, and
// WorkOS requires exactly one of connection/organization/provider — so the
// empty one collides with the per-request `organization` we pass at signIn.
export const WorkOSProvider = WorkOS({
  clientId: process.env.AUTH_WORKOS_ID,
  clientSecret: process.env.AUTH_WORKOS_SECRET,
  authorization: { url: "https://api.workos.com/sso/authorize", params: {} },
  allowDangerousEmailAccountLinking: true,
});

// An `AuthError` is rethrown to a server-action `signIn`; a plain throw comes
// back as a `?error=Configuration` URL and the form would report the link sent.
class MagicLinkRefused extends AuthError {
  static type = "MagicLinkRefused";
  static kind = "signIn" as const;
}

// `apiKey` stays undefined: the email goes through our own template and client,
// which prints the link in development instead of sending. Screening lives here
// rather than in the form action because `POST /api/auth/signin/resend` reaches
// this provider directly.
export const ResendProvider = Resend({
  apiKey: undefined,
  async sendVerificationRequest(params) {
    // Lazy: the proxy loads this module too, and it has no use for the
    // disposable-domain list or Redis.
    const [{ default: MailChecker }, { magicLinkRateLimit }] =
      await Promise.all([
        import("mailchecker"),
        import("@/lib/rate-limit/magic-link"),
      ]);

    const email = params.identifier;
    if (!MailChecker.isValid(email)) {
      throw new MagicLinkRefused("disposable domain");
    }
    const ip = resolveClientIp(params.request.headers) ?? "unknown";
    if (!(await magicLinkRateLimit({ ip, email }))) {
      throw new MagicLinkRefused("rate limited");
    }

    // Self-hosted installs may run without a Resend key: print the link to the
    // dashboard log as before and treat a failed send as non-fatal.
    const selfHosted = process.env.SELF_HOST === "true";
    if (selfHosted && process.env.NODE_ENV !== "development") {
      console.log(`>>> Magic Link: ${params.url}`);
    }
    try {
      const emailClient = new EmailClient({
        apiKey: process.env.RESEND_API_KEY ?? "",
      });
      await emailClient.sendDashboardMagicLink({ link: params.url, to: email });
    } catch (cause) {
      if (selfHosted) {
        console.warn("magic link email not sent, use the printed link", cause);
        return;
      }
      throw new MagicLinkRefused("send failed", { cause });
    }
  },
});
