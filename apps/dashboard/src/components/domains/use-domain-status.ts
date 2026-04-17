import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";

import type { StepCardVariant } from "@/components/forms/step-card";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

export function useDomainStatus(domain?: string) {
  const trpc = useTRPC();
  const {
    data: domainJson,
    refetch: refetchDomain,
    isLoading: isLoadingDomain,
    isRefetching: isRefetchingDomain,
  } = useQuery(trpc.domain.getDomainResponse.queryOptions({ domain }));
  const {
    data: configJson,
    refetch: refetchConfig,
    isLoading: isLoadingConfig,
    isRefetching: isRefetchingConfig,
  } = useQuery(trpc.domain.getConfigResponse.queryOptions({ domain }));
  const {
    data: verificationJson,
    refetch: refetchVerification,
    isLoading: isLoadingVerification,
    isRefetching: isRefetchingVerification,
  } = useQuery(
    trpc.domain.verifyDomain.queryOptions(
      { domain },
      { enabled: !domainJson?.verified },
    ),
  );

  const refreshAll = useCallback(() => {
    refetchDomain();
    refetchConfig();
    refetchVerification();
  }, [refetchDomain, refetchConfig, refetchVerification]);

  let status: DomainVerificationStatusProps = "Valid Configuration";

  if (domainJson?.error?.code === "not_found") {
    // domain not found on Vercel project
    status = "Domain Not Found";

    // unknown error
  } else if (domainJson?.error) {
    status = "Unknown Error";

    // if domain is not verified, we try to verify now
  } else if (!domainJson?.verified) {
    status = "Pending Verification";

    // domain was just verified
    if (verificationJson?.verified) {
      status = "Valid Configuration";
    }
  } else if (configJson?.misconfigured) {
    status = "Invalid Configuration";
  } else {
    status = "Valid Configuration";
  }

  const isLoading =
    isLoadingDomain ||
    isLoadingConfig ||
    isLoadingVerification ||
    isRefetchingDomain ||
    isRefetchingConfig ||
    isRefetchingVerification;

  const steps = {
    dns:
      status === "Valid Configuration" || status === "Pending Verification"
        ? "completed"
        : "active",
    verification:
      status === "Valid Configuration"
        ? "completed"
        : status === "Pending Verification"
          ? "active"
          : // "Invalid Configuration" means DNS is misconfigured but ownership is verified
            status === "Invalid Configuration"
            ? "completed"
            : "upcoming",
    ready: status === "Valid Configuration" ? "completed" : "upcoming",
  } satisfies Record<string, StepCardVariant>;

  return {
    status,
    domainJson,
    steps,
    refresh: refreshAll,
    isLoading,
  };
}
