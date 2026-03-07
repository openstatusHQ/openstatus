"use server";

import { signIn } from "@/lib/auth";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { TRPCClientError } from "@trpc/client";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function signInWithResendAction(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const redirectTo = formData.get("redirectTo") as string;
    const domain = formData.get("domain") as string;

    if (!email || !redirectTo) {
      return {
        success: false,
        error: "Email and redirectTo are required",
      };
    }

    const queryClient = getQueryClient();
    // NOTE: throws an error if the email domain is not allowed
    try {
      await queryClient.fetchQuery(
        trpc.statusPage.validateEmailDomain.queryOptions({
          slug: domain,
          email,
        }),
      );
    } catch (error) {
      console.error("[SignIn] Email validation failed", error);
      if (error instanceof TRPCClientError) {
        return { success: false, error: error.message };
      }
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: "An unexpected error occurred during sign in",
      };
    }

    await signIn("resend", {
      email,
      redirectTo,
    });

    return { success: true };
  } catch (e) {
    // NOTE: https://github.com/nextauthjs/next-auth/discussions/9389
    if (isRedirectError(e)) {
      return { success: true };
    }
    console.error("[SignIn] Error:", e);
    if (e instanceof AuthError) {
      return { success: false, error: e.type };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }

    return {
      success: false,
      error: "An unexpected error occurred during sign in",
    };
  }
}
