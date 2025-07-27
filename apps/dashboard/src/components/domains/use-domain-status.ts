import type { DomainVerificationStatusProps } from "@openstatus/api/src/router/domain";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function useDomainStatus(domain: string) {
  const trpc = useTRPC();
  const { data: domainJson, refetch: refetchDomain } = useQuery(
    trpc.domain.getDomainResponse.queryOptions({ domain }),
  );
  const { data: configJson, refetch: refetchConfig } = useQuery(
    trpc.domain.getConfigResponse.queryOptions({ domain }),
  );
  const { data: verificationJson, refetch: refetchVerification } = useQuery(
    trpc.domain.verifyDomain.queryOptions(
      { domain },
      { enabled: !domainJson?.verified },
    ),
  );

  // NOTE: refetch every 5 seconds to check for the status
  useEffect(() => {
    const interval = setInterval(() => {
      refetchDomain();
      refetchConfig();
      refetchVerification();
    }, 5000);
    return () => clearInterval(interval);
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
  return {
    status,
    domainJson,
  };
}
