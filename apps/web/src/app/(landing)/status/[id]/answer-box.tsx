import { REPORT_WINDOW_MINUTES } from "@openstatus/api/src/router/effective-status";
import { cn } from "@openstatus/ui/lib/utils";
import type React from "react";

import { getPillStyle } from "../external-service-pill";
import { formatRelative } from "../utils";

export function AnswerBox({
  answer,
  indicator,
  status,
  message,
  checkedAt,
  stale,
  reporters,
  links,
}: {
  answer: string;
  // Pass "" when there is no live data, so the box reads as unknown.
  indicator: string;
  status: string;
  message?: string;
  checkedAt: number;
  stale: boolean;
  reporters: number;
  links: React.ReactNode;
}) {
  const pill = getPillStyle({ indicator, status });
  return (
    <div className={cn("not-prose flex flex-col gap-2 border p-3", pill.box)}>
      <p className="text-foreground m-0 flex items-start gap-2 font-semibold">
        <span
          aria-hidden="true"
          className={cn("mt-[0.45em] size-2.5 shrink-0", pill.dot)}
        />
        {answer}
      </p>
      {message ? <p className="text-foreground/80 m-0">{message}</p> : null}
      <p className="text-muted-foreground m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          {checkedAt > 0
            ? `Checked ${formatRelative(checkedAt)}`
            : "Not checked yet"}
          {stale && checkedAt > 0 ? (
            <span className="text-warning"> (stale)</span>
          ) : null}
        </span>
        <span className="tabular-nums">
          {reporters} {reporters === 1 ? "user report" : "user reports"} in{" "}
          {REPORT_WINDOW_MINUTES} min
        </span>
        {links}
      </p>
    </div>
  );
}

export function AnswerLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      className="text-foreground underline underline-offset-4"
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
