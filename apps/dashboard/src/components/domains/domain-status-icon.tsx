"use client";

import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";
import { Warning, Check, Loading, Close } from "@openstatus/icons";

export function DomainStatusIcon({
  status,
  loading,
}: {
  status?: DomainVerificationStatusProps;
  loading?: boolean;
}) {
  return loading ? (
    <Loading
      className="text-muted-foreground size-6 animate-spin"
      stroke="currentColor"
    />
  ) : status === "Valid Configuration" ? (
    <div className="bg-success flex size-6 items-center justify-center rounded-full">
      <Check className="text-background size-3" />
    </div>
  ) : status === "Pending Verification" ? (
    <div className="bg-warning flex size-6 items-center justify-center rounded-full">
      <Warning className="text-background size-3" />
    </div>
  ) : (
    <div className="bg-destructive flex size-6 items-center justify-center rounded-full">
      <Close className="text-background size-3" />
    </div>
  );
}
