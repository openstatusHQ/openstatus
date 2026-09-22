import type { Profile } from "next-auth";
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

export const ResendProvider = Resend({
  apiKey: undefined, // REMINDER: keep undefined to avoid sending emails
  async sendVerificationRequest(params) {
    console.log("");
    console.log(`>>> Magic Link: ${params.url}`);
    console.log("");
  },
});
