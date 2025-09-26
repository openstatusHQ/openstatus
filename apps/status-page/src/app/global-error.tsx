"use client";

import { Link } from "@/components/common/link";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

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
        <main className="flex min-h-screen w-full flex-col space-y-6 bg-background p-4 md:p-8">
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            <div className="mx-auto max-w-xl border bg-card text-center">
              <div className="flex flex-col gap-4 p-6 sm:p-12">
                <div className="flex flex-col gap-1">
                  <h2 className="font-cal text-2xl text-foreground">
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
