import { GitHubIcon } from "@openstatus/icons/brand";
import { GoogleIcon } from "@openstatus/icons/brand";
import { Separator } from "@openstatus/ui/components/ui/separator";
import type { Metadata } from "next";
import Link from "next/link";
import type { SearchParams } from "nuqs/server";

import { signIn } from "@/lib/auth";

import { LoginButton } from "./_components/login-button";
import MagicLinkForm from "./_components/magic-link-form";
import { SsoForm } from "./_components/sso-form";
import { searchParamsCache } from "./search-params";

const hasWorkOS = Boolean(
  process.env.AUTH_WORKOS_ID && process.env.AUTH_WORKOS_SECRET,
);

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
      {error === "AccessDenied" ? (
        <p className="text-destructive mx-auto max-w-md px-8 text-center text-sm text-pretty">
          Your SSO login isn&apos;t linked to a workspace yet. Contact your
          workspace admin.
        </p>
      ) : null}
      <div className="grid gap-4 p-4">
        {process.env.NODE_ENV === "development" ||
        process.env.SELF_HOST === "true" ? (
          <div className="grid gap-4">
            <MagicLinkForm />
            <Separator />
          </div>
        ) : null}
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: redirectTo ?? undefined });
          }}
          className="w-full"
        >
          <LoginButton type="submit" provider="github">
            Sign in with GitHub <GitHubIcon className="ml-2 h-4 w-4" />
          </LoginButton>
        </form>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: redirectTo ?? undefined });
          }}
          className="w-full"
        >
          <LoginButton type="submit" provider="google">
            Sign in with Google <GoogleIcon className="ml-2 h-4 w-4" />
          </LoginButton>
        </form>
        {process.env.AUTH_OIDC_ISSUER ? (
          <form
            action={async () => {
              "use server";
              await signIn("oidc", { redirectTo: redirectTo ?? undefined });
            }}
            className="w-full"
          >
            <LoginButton type="submit" provider="oidc">
              Sign in with {process.env.AUTH_OIDC_NAME ?? "SSO"}
            </LoginButton>
          </form>
        ) : null}
        {hasWorkOS ? <SsoForm redirectTo={redirectTo ?? undefined} /> : null}
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
