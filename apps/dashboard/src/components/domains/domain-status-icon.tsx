"use client";

import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";

import { AlertCircle, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

export default function DomainStatusIcon({
  status,
  loading,
}: {
  status: DomainVerificationStatusProps;
  loading?: boolean;
}) {
  return loading ? (
    <LoaderCircle
      className="text-muted-foreground animate-spin"
      stroke="currentColor"
    />
  ) : status === "Valid Configuration" ? (
    <CheckCircle2
      fill="#22c55e"
      stroke="currentColor"
      className="text-background"
    />
  ) : status === "Pending Verification" ? (
    <AlertCircle
      fill="#eab308"
      stroke="currentColor"
      className="text-background"
    />
  ) : (
    <XCircle fill="#ef4444" stroke="currentColor" className="text-background" />
  );
}
