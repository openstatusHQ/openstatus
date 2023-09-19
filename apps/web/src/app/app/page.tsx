"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/dashboard/shell";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingAnimation } from "@/components/loading-animation";

// TODO: discuss how to make that page a bit more enjoyable
export default function Page() {
  const router = useRouter();

  // waiting for the workspace to be created
  setTimeout(() => router.refresh(), 1000);

  return (
    <div className="container relative mx-auto flex min-h-screen w-full flex-col items-center justify-center gap-6 p-4 lg:p-8">
      <AppHeader />
      <div className="flex w-full flex-1 gap-6 lg:gap-8">
        <main className="z-10 flex w-full flex-1 flex-col items-start justify-center">
          <Shell className="relative flex flex-1 flex-col items-center justify-center">
            <div className="grid gap-4">
              <div className="text-center">
                <p className="mb-1 text-lg font-bold">Creating Workspace</p>
                <p className="text-muted-foreground mb-3">
                  Should be done in a second.
                </p>
                <p className="text-muted-foreground text-sm font-light">
                  If you are stuck for longer, please contact us via{" "}
                  <a
                    href="https://openstatus.dev/discord"
                    target="_blank"
                    className="font-normal"
                  >
                    Discord
                  </a>{" "}
                  or{" "}
                  <a
                    href="mailto:thibault@openstatus.dev"
                    className="font-normal"
                  >
                    Mail
                  </a>
                  .
                </p>
              </div>
              <LoadingAnimation variant="inverse" size="lg" />
            </div>
          </Shell>
        </main>
      </div>
    </div>
  );
}
