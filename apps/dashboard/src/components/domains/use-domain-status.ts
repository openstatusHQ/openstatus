import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import type { StepCardVariant } from "@/components/forms/step-card";
import { useTRPC } from "@/lib/trpc/client";

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

  const dnsReady =
    !!domainJson?.verified && configJson?.misconfigured === false;
  const {
    data: certificateJson,
    refetch: refetchCertificate,
    isLoading: isLoadingCertificate,
    isRefetching: isRefetchingCertificate,
  } = useQuery(
    trpc.domain.getCertificateStatus.queryOptions(
      { domain },
      { enabled: dnsReady },
    ),
  );

  const issueCertificateMutation = useMutation(
    trpc.domain.issueCertificate.mutationOptions(),
  );

  const refreshAll = useCallback(() => {
    refetchDomain();
    refetchConfig();
    refetchVerification();
    if (dnsReady) refetchCertificate();
  }, [
    refetchDomain,
    refetchConfig,
    refetchVerification,
    refetchCertificate,
    dnsReady,
  ]);

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
  } else if (certificateJson && !certificateJson.ready) {
    status = "Generating SSL Certificate";
  } else {
    status = "Valid Configuration";
  }

  const isLoading =
    isLoadingDomain ||
    isLoadingConfig ||
    isLoadingVerification ||
    (dnsReady && isLoadingCertificate) ||
    isRefetchingDomain ||
    isRefetchingConfig ||
    isRefetchingVerification ||
    isRefetchingCertificate;

  const steps = {
    dns:
      status === "Valid Configuration" ||
      status === "Pending Verification" ||
      status === "Generating SSL Certificate"
        ? "completed"
        : "active",
    verification:
      status === "Valid Configuration" ||
      status === "Generating SSL Certificate"
        ? "completed"
        : status === "Pending Verification"
          ? "active"
          : // "Invalid Configuration" means DNS is misconfigured but ownership is verified
            status === "Invalid Configuration"
            ? "completed"
            : "upcoming",
    certificate:
      status === "Valid Configuration"
        ? "completed"
        : status === "Generating SSL Certificate"
          ? "active"
          : "upcoming",
  } satisfies Record<string, StepCardVariant>;

  return {
    status,
    domainJson,
    steps,
    refresh: refreshAll,
    issueCertificateMutation,
    isLoading,
  };
}
