"use client";

import * as React from "react";
import { useSignIn } from "@clerk/nextjs";
import type { OAuthStrategy } from "@clerk/nextjs/dist/types/server";

import { Button } from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";

export function OauthButtons() {
  const [isLoading, setIsLoading] = React.useState<OAuthStrategy | null>(null);
  const { signIn, isLoaded: signInLoaded } = useSignIn();

  const oauthSignIn = async (provider: OAuthStrategy) => {
    if (!signInLoaded) {
      return null;
    }
    try {
      setIsLoading(provider);
      await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/app",
        redirectUrlComplete: "/app",
      });
    } catch (err) {
      console.error(err);
      setIsLoading(null);
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => oauthSignIn("oauth_github")}>
        {isLoading === "oauth_github" ? (
          <LoadingAnimation className="h-4 w-4" />
        ) : (
          <>
            <Icons.github className="mr-2 h-4 w-4" />
            GitHub
          </>
        )}
      </Button>
      <Button onClick={() => oauthSignIn("oauth_google")}>
        {isLoading === "oauth_google" ? (
          <LoadingAnimation className="h-4 w-4" />
        ) : (
          <>
            <Icons.google className="mr-2 h-4 w-4" />
            Google
          </>
        )}
      </Button>
    </div>
  );
}
