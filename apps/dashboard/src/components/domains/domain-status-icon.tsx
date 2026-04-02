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
      fill="#22c55e"
      stroke="currentColor"
      className="size-6 text-background"
    />
  ) : status === "Pending Verification" ? (
    <AlertCircle
      fill="#eab308"
      stroke="currentColor"
      className="size-6 text-background"
    />
  ) : (
    <XCircle
      fill="#ef4444"
      stroke="currentColor"
      className="size-6 text-background"
    />
  );
}
