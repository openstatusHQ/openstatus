"use client";

import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";

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
    <div className="flex size-6 items-center justify-center rounded-full bg-success">
      <Check className="size-3 text-background" />
    </div>
  ) : status === "Pending Verification" ? (
    <div className="flex size-6 items-center justify-center rounded-full bg-warning">
      <AlertTriangle className="size-3 text-background" />
    </div>
  ) : (
    <div className="flex size-6 items-center justify-center rounded-full bg-destructive">
      <X className="size-3 text-background" />
    </div>
  );
}
