"use client";

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";

import { LoadingAnimation } from "../loading-animation";

export default function DomainStatusIcon({
  status,
}: {
  status?: DomainVerificationStatusProps;
}) {
  return !status ? (
    <LoadingAnimation variant="inverse" className="h-6 w-6" />
  ) : status === "Valid Configuration" ? (
    <CheckCircle2
      fill="#22c55e"
      stroke="currentColor"
      className="text-background h-6 w-6"
    />
  ) : status === "Pending Verification" ? (
    <AlertCircle
      fill="#eab308"
      stroke="currentColor"
      className="text-background h-6 w-6"
    />
  ) : (
    <XCircle
      fill="#ef4444"
      stroke="currentColor"
      className="text-background h-6 w-6"
    />
  );
}
