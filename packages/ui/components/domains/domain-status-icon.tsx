"use client";

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";

import { LoadingAnimation } from "../loading-animation";

export default function DomainStatusIcon({
  status,
  loading,
}: {
  status: DomainVerificationStatusProps;
  loading?: boolean;
}) {
  return loading ? (
    <LoadingAnimation />
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
