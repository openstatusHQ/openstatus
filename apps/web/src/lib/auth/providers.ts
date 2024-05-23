import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

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

export const ResendProvider = Resend({
  apiKey: undefined, // REMINDER: keep undefined to avoid sending emails
  async sendVerificationRequest(params) {
    console.log("");
    console.log(`>>> Magic Link: ${params.url}`);
    console.log("");
  },
});
