"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Rendered in place of the root layout, so nothing from it (NuqsAdapter, tRPC,
// theme) exists here — plain anchors only, or this page throws too.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="bg-background flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            <div className="bg-card mx-auto max-w-xl border text-center">
              <div className="flex flex-col gap-4 p-6 sm:p-12">
                <div className="flex flex-col gap-1">
                  <h2 className="font-cal text-foreground text-2xl">
                    Application Error
                  </h2>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    An unexpected error occurred. This has been reported and
                    we&apos;re working on it.{" "}
                    <a
                      href="mailto:ping@openstatus.dev"
                      className="text-foreground font-medium"
                    >
                      Contact us
                    </a>{" "}
                    if it persists.
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={reset}
                    className="cursor-pointer"
                  >
                    Try Again
                  </Button>
                  <Button size="lg" asChild>
                    <a href="/">Go Home</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
