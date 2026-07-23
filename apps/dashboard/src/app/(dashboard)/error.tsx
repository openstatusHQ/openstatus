"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { Code } from "@/components/common/code";

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
      <div className="border-border bg-sidebar mx-auto w-full max-w-md rounded-lg border">
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-destructive font-mono">500 Error</p>
            <h2 className="font-cal text-foreground text-2xl">
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
            <Code className="border-border bg-background text-destructive max-h-40 overflow-auto rounded-md border">
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
