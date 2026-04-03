"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";

export function DomainStatusIcon({
  status,
  loading,
}: {
  status: DomainVerificationStatusProps;
  loading?: boolean;
}) {
  return loading ? (
    <LoaderCircle
      className="size-6 animate-spin text-muted-foreground"
      stroke="currentColor"
    />
  ) : status === "Valid Configuration" ? (
    <CheckCircle2
      fill="var(--color-success)"
      stroke="currentColor"
      className="size-6 text-background"
    />
  ) : status === "Pending Verification" ? (
    <AlertCircle
      fill="var(--color-warning)"
      stroke="currentColor"
      className="size-6 text-background"
    />
  ) : (
    <XCircle
      fill="var(--color-destructive)"
      stroke="currentColor"
      className="size-6 text-background"
    />
  );
}
