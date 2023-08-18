"use client";

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";

import { LoadingAnimation } from "../loading-animation";

export default function DomainStatusIcon({
  status,
  loading,
}: {
  status: DomainVerificationStatusProps;
  loading: boolean;
}) {
  return loading ? (
    <LoadingAnimation />
  ) : status === "Valid Configuration" ? (
    <CheckCircle2
      fill="#2563EB"
      stroke="currentColor"
      className="text-white dark:text-black"
    />
  ) : status === "Pending Verification" ? (
    <AlertCircle
      fill="#FBBF24"
      stroke="currentColor"
      className="text-white dark:text-black"
    />
  ) : (
    <XCircle
      fill="#DC2626"
      stroke="currentColor"
      className="text-white dark:text-black"
    />
  );
}
