import { useEffect, useState } from "react";

import type {
  DomainResponse,
  DomainVerificationStatusProps,
} from "@openstatus/api/src/router/domain";

import { api } from "@/trpc/client";

export function useDomainStatus(domain: string) {
  const [domainVerification, setDomainVerification] = useState<{
    status: DomainVerificationStatusProps;
    domainJson: DomainResponse & { error?: { code: string; message: string } };
  }>();

  useEffect(() => {
    async function checkDomain() {
      const data = await verifyDomain(domain);
      setDomainVerification(data);
    }
    checkDomain(); // first render!
    setInterval(checkDomain, 5000);
    // clearInterval(myInterval)
  }, [domain]);

  return domainVerification;
}

export async function verifyDomain(domain: string) {
  let status: DomainVerificationStatusProps = "Valid Configuration";
  const [domainJson, configJson] = await Promise.all([
    api.domain.getDomainResponse.query({ domain }),
    api.domain.getConfigResponse.query({ domain }),
  ]);

  if (domainJson?.error?.code === "not_found") {
    // domain not found on Vercel project
    status = "Domain Not Found";

    // unknown error
  } else if (domainJson.error) {
    status = "Unknown Error";

    // if domain is not verified, we try to verify now
  } else if (!domainJson.verified) {
    status = "Pending Verification";
    const verificationJson = await api.domain.verifyDomain.query({ domain });

    // domain was just verified
    if (verificationJson?.verified) {
      status = "Valid Configuration";
    }
  } else if (configJson.misconfigured) {
    status = "Invalid Configuration";
  } else {
    status = "Valid Configuration";
  }
  return {
    status,
    domainJson,
  };
}
