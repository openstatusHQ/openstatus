"use client";

import { Code } from "@/components/common/code";
import { Button } from "@openstatus/ui/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-8">
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-sidebar">
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <p className="font-mono text-destructive">500 Error</p>
            <h2 className="font-cal text-2xl text-foreground">
              Something went wrong
            </h2>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred. If this keeps happening, please{" "}
              <a
                href="mailto:ping@openstatus.dev"
                className="text-foreground underline underline-offset-4"
              >
                contact us
              </a>
              .
            </p>
          </div>
          {process.env.NODE_ENV === "development" && (
            <Code className="max-h-40 overflow-auto rounded-md border border-border bg-background text-destructive">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </Code>
          )}
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
            <Button asChild>
              <Link href="/overview">Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
