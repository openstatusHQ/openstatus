"use server";

import { signIn } from "@/lib/auth";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function signInWithResendAction(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const redirectTo = formData.get("redirectTo") as string;
    const domain = formData.get("domain") as string;

    if (!email || !redirectTo) {
      throw new Error("Email and redirectTo are required");
    }

    const queryClient = getQueryClient();
    // NOTE: throws an error if the email domain is not allowed
    await queryClient.fetchQuery(
      trpc.statusPage.validateEmailDomain.queryOptions({ slug: domain, email }),
    );

    await signIn("resend", {
      email,
      redirectTo,
    });
  } catch (e) {
    // NOTE: https://github.com/nextauthjs/next-auth/discussions/9389
    if (isRedirectError(e)) return;
    console.error(e);
    if (e instanceof AuthError) {
      throw new Error(`Authentication error: ${e.type}`);
    }
    throw e;
  }
}
