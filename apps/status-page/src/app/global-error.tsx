"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Link } from "@/components/common/link";

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
                    <Link href="mailto:ping@openstatus.dev">Contact us</Link> if
                    it persists.
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
                    <Link href="/">Go Home</Link>
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
