import { GitHubIcon } from "@openstatus/icons/brand";
import { GoogleIcon } from "@openstatus/icons/brand";
import type { Metadata } from "next";
import Link from "next/link";
import type { SearchParams } from "nuqs/server";

import { signIn } from "@/lib/auth";

import { EmailForm } from "./_components/email-form";
import { LoginButton } from "./_components/login-button";
import { searchParamsCache } from "./search-params";

const hasWorkOS = Boolean(
  process.env.AUTH_WORKOS_ID && process.env.AUTH_WORKOS_SECRET,
);

// Auth.js error codes that land on `/login?error=`; anything else stays silent.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Your SSO login isn't linked to a workspace yet. Contact your workspace admin.",
  Verification:
    "That sign-in link has expired or was already used. Request a new one.",
};

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to openstatus. Monitor your services and keep your users informed.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://app.openstatus.dev/login",
  },
};

export default async function Page(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const { redirectTo, error } = searchParamsCache.parse(searchParams);

  return (
    <div className="my-16 grid w-full max-w-lg gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-cal text-3xl tracking-tight">Sign In</h1>
        <p className="font-commit-mono text-muted-foreground text-sm text-pretty">
          Get started now. No credit card required.
        </p>
      </div>
      {error && Object.hasOwn(ERROR_MESSAGES, error) ? (
        <p className="text-destructive mx-auto max-w-md px-8 text-center text-sm text-pretty">
          {ERROR_MESSAGES[error]}
        </p>
      ) : null}
      <div className="grid gap-3 p-4">
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: redirectTo ?? undefined });
          }}
        >
          <LoginButton type="submit" provider="github" variant="default">
            <GitHubIcon className="h-4 w-4" /> Continue with GitHub
          </LoginButton>
        </form>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: redirectTo ?? undefined });
          }}
        >
          <LoginButton type="submit" provider="google" variant="default">
            <GoogleIcon className="h-4 w-4" /> Continue with Google
          </LoginButton>
        </form>
        {process.env.AUTH_OIDC_ISSUER ? (
          <form
            action={async () => {
              "use server";
              await signIn("oidc", { redirectTo: redirectTo ?? undefined });
            }}
          >
            <LoginButton type="submit" provider="oidc">
              Continue with {process.env.AUTH_OIDC_NAME ?? "SSO"}
            </LoginButton>
          </form>
        ) : null}
        <EmailForm redirectTo={redirectTo ?? undefined} sso={hasWorkOS} />
      </div>
      <p className="text-muted-foreground mx-auto max-w-md px-8 text-center text-xs text-pretty">
        By clicking continue, you agree to our{" "}
        <Link
          href="https://openstatus.dev/legal/terms"
          className="hover:text-primary underline underline-offset-4 hover:no-underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="https://openstatus.dev/legal/privacy"
          className="hover:text-primary underline underline-offset-4 hover:no-underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
