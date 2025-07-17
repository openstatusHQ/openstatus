"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* This is the default Next.js error component but it doesn't allow omitting the statusCode property yet. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <NextError statusCode={undefined as any} />
      </body>
    </html>
  );
}
