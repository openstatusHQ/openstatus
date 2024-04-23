"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import type { OAuthStrategy } from "@clerk/nextjs/dist/types/server";

import { Button } from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";

export function OauthButtons({ type }: { type: "sign-in" | "sign-up" }) {
  const [isLoading, setIsLoading] = React.useState<OAuthStrategy | null>(null);
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const searchParams = useSearchParams();

  const oauthSignIn = async (provider: OAuthStrategy) => {
    if (!signInLoaded || !signUpLoaded) {
      return null;
    }
    try {
      setIsLoading(provider);

      const redirectUrl = searchParams.get("redirect_url") || "/app";
      if (type === "sign-in") {
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl,
          redirectUrlComplete: redirectUrl,
        });
        return;
      }
      if (type === "sign-up") {
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl,
          redirectUrlComplete: redirectUrl,
        });
        return;
      }
    } catch (err) {
      console.error(err);
      setIsLoading(null);
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="@container">
      <div className="@md:flex-row flex w-full flex-col gap-2">
        <Button
          onClick={() => oauthSignIn("oauth_github")}
          className="w-full"
          disabled={isLoading === "oauth_github"}
        >
          {isLoading === "oauth_github" ? (
            <LoadingAnimation />
          ) : (
            <>
              <Icons.github className="mr-2 h-4 w-4" />
              GitHub
            </>
          )}
        </Button>
        <Button
          onClick={() => oauthSignIn("oauth_google")}
          className="w-full"
          disabled={isLoading === "oauth_google"}
        >
          {isLoading === "oauth_google" ? (
            <LoadingAnimation />
          ) : (
            <>
              <Icons.google className="mr-2 h-4 w-4" />
              Google
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
