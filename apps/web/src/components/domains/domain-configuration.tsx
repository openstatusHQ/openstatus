"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, XCircle } from "lucide-react";

import type {
  DomainResponse,
  DomainVerificationStatusProps,
} from "@openstatus/api/src/router/domain";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSubdomain } from "@/lib/domains";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";
import DomainStatusIcon from "./domain-status-icon";

export const InlineSnippet = ({
  className,
  children,
}: {
  className?: string;
  children?: string;
}) => {
  return (
    <span
      className={cn(
        "bg-muted inline-block rounded-md px-1 py-0.5 font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
};
export default function DomainConfiguration({ domain }: { domain: string }) {
  const [domainVerification, setDomainVerification] = useState<{
    status: DomainVerificationStatusProps;
    domainJson: DomainResponse & { error?: { code: string; message: string } };
  }>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function checkDomain() {
      const data = await checker(domain);
      setDomainVerification(data);
    }
    checkDomain(); // first check
    const myInterval = setInterval(() => {
      startTransition(async () => {
        await checkDomain();
      });
    }, 5000);
    // clearInterval(myInterval)
  }, [domain]);

  const { status, domainJson } = domainVerification || {};

  if (!status || status === "Valid Configuration" || !domainJson) return null;

  const subdomain =
    domainJson?.name && domainJson?.apexName
      ? getSubdomain(domainJson.name, domainJson.apexName)
      : null;

  const txtVerification =
    (status === "Pending Verification" &&
      domainJson?.verification?.find((x: any) => x.type === "TXT")) ||
    null;

  return (
    <div>
      <div className="mb-4 flex items-center space-x-2">
        <DomainStatusIcon status={status} loading={isPending} />
        <p className="text-lg font-semibold">{status}</p>
      </div>
      {txtVerification ? (
        <>
          <p className="text-sm">
            Please set the following TXT record on{" "}
            <InlineSnippet>{domainJson.apexName}</InlineSnippet> to prove
            ownership of <InlineSnippet>{domainJson.name}</InlineSnippet>:
          </p>
          <div className="bg-muted my-5 flex items-start justify-start space-x-10 rounded-md p-2">
            <div>
              <p className="text-sm font-bold">Type</p>
              <p className="mt-2 font-mono text-sm">{txtVerification.type}</p>
            </div>
            <div>
              <p className="text-sm font-bold">Name</p>
              <p className="mt-2 font-mono text-sm">
                {txtVerification.domain.slice(
                  0,
                  txtVerification.domain.length -
                    (domainJson?.apexName?.length || 0) -
                    1,
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold">Value</p>
              <p className="mt-2 font-mono text-sm">
                <span className="text-ellipsis">{txtVerification.value}</span>
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Warning: if you are using this domain for another site, setting this
            TXT record will transfer domain ownership away from that site and
            break it. Please exercise caution when setting this record.
          </p>
        </>
      ) : status === "Unknown Error" ? (
        <p className="mb-5 text-sm">{domainJson?.error?.message}</p>
      ) : (
        <>
          <Tabs defaultValue={subdomain ? "CNAME" : "A"}>
            <TabsList>
              <TabsTrigger value="A">
                A Record{!subdomain && " (recommended)"}
              </TabsTrigger>
              <TabsTrigger value="CNAME">
                CNAME Record{subdomain && " (recommended)"}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="A">
              <div className="my-3 text-left">
                <p className="my-5 text-sm">
                  To configure your apex domain (
                  <InlineSnippet>{domainJson.apexName}</InlineSnippet>
                  ), set the following A record on your DNS provider to
                  continue:
                </p>
                <div className="bg-muted flex items-center justify-start space-x-10 rounded-md p-2">
                  <div>
                    <p className="text-sm font-bold">Type</p>
                    <p className="mt-2 font-mono text-sm">A</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">Name</p>
                    <p className="mt-2 font-mono text-sm">@</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">Value</p>
                    <p className="mt-2 font-mono text-sm">76.76.21.21</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">TTL</p>
                    <p className="mt-2 font-mono text-sm">86400</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="CNAME">
              <div className="my-3 text-left">
                <p className="my-5 text-sm">
                  To configure your subdomain (
                  <InlineSnippet>{domainJson.name}</InlineSnippet>
                  ), set the following CNAME record on your DNS provider to
                  continue:
                </p>
                <div className="bg-muted flex items-center justify-start space-x-10 rounded-md p-2">
                  <div>
                    <p className="text-sm font-bold">Type</p>
                    <p className="mt-2 font-mono text-sm">CNAME</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">Name</p>
                    <p className="mt-2 font-mono text-sm">
                      {subdomain ?? "www"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">Value</p>
                    <p className="mt-2 font-mono text-sm">
                      {`cname.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">TTL</p>
                    <p className="mt-2 font-mono text-sm">86400</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <p className="muted-foreground mt-5 text-sm">
            Note: for TTL, if <InlineSnippet>86400</InlineSnippet> is not
            available, set the highest value possible. Also, domain propagation
            can take up to an hour.
          </p>
        </>
      )}
    </div>
  );
}

async function checker(domain: string) {
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
    if (verificationJson && verificationJson.verified) {
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
