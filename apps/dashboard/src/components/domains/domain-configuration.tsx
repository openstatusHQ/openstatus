"use client";

import {
  StepCard,
  StepCardBadge,
  StepCardContent,
  StepCardHeader,
  StepCardIndicator,
  StepCardTitle,
} from "@/components/forms/step-card";
import { getSubdomain } from "@/lib/domains";
import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import { DomainStatusIcon } from "./domain-status-icon";
import { useDomainStatus } from "./use-domain-status";

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
        "inline-block rounded-md bg-muted px-1 py-0.5 font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
};

const CNAME_VALUE =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_DNS_CNAME || "cname.vercel-dns.com";
const A_RECORD_VALUE =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_DNS_A || "76.76.21.21";

// FIXME: add loading state!
export default function DomainConfiguration({ domain }: { domain: string }) {
  const { status, domainJson, steps, isLoading } = useDomainStatus(domain);

  if (!status || !domainJson) return null;

  const subdomain =
    domainJson?.name && domainJson?.apexName
      ? getSubdomain(domainJson.name, domainJson.apexName)
      : null;

  const txtVerification =
    (status === "Pending Verification" &&
      domainJson?.verification?.find((x) => x.type === "TXT")) ||
    null;

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <DomainStatusIcon status={status} loading={isLoading} />
        <p className="font-semibold text-sm">{status}</p>
        <Badge variant="secondary">{domain}</Badge>
      </div>

      {/* Step 1: DNS Configuration */}
      <StepCard variant={"completed"}>
        <StepCardHeader>
          <StepCardIndicator step={1} />
          <StepCardTitle>Configure DNS records</StepCardTitle>
          <StepCardBadge>Done</StepCardBadge>
        </StepCardHeader>
        <StepCardContent>
          {status === "Unknown Error" ? (
            <p className="text-sm">{domainJson?.error?.message}</p>
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
                <TabsContent value="A" className="space-y-2">
                  <p className="text-sm">
                    To configure your apex domain (
                    <InlineSnippet>{domainJson.apexName}</InlineSnippet>
                    ), set the following A record on your DNS provider:
                  </p>
                  <div className="flex items-center justify-start space-x-10 rounded-md bg-muted p-2">
                    <div>
                      <p className="font-bold text-sm">Type</p>
                      <p className="mt-2 font-mono text-sm">A</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm">Name</p>
                      <p className="mt-2 font-mono text-sm">@</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm">Value</p>
                      <p className="mt-2 font-mono text-sm">{A_RECORD_VALUE}</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm">TTL</p>
                      <p className="mt-2 font-mono text-sm">86400</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="CNAME">
                  <div className="flex items-center justify-start space-x-10 rounded-md bg-muted p-2">
                    <div>
                      <p className="font-bold text-sm">Type</p>
                      <p className="mt-2 font-mono text-sm">CNAME</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm">Name</p>
                      <p className="mt-2 font-mono text-sm">
                        {subdomain ?? "www"}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-sm">Value</p>
                      <p className="mt-2 font-mono text-sm">{CNAME_VALUE}</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm">TTL</p>
                      <p className="mt-2 font-mono text-sm">86400</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <p className="mt-3 text-muted-foreground text-sm">
                Note: for TTL, if <InlineSnippet>86400</InlineSnippet> is not
                available, set the highest value possible. Domain propagation
                can take up to an hour.
              </p>
            </>
          )}
        </StepCardContent>
      </StepCard>

      {/* Step 2: Domain Verification */}
      <StepCard variant={steps.verification}>
        <StepCardHeader>
          <StepCardIndicator step={2} />
          <StepCardTitle>Verify domain ownership</StepCardTitle>
          <StepCardBadge>Done</StepCardBadge>
        </StepCardHeader>
        <StepCardContent>
          {txtVerification ? (
            <>
              <p className="text-sm">
                Set the following TXT record on{" "}
                <InlineSnippet>{domainJson.apexName}</InlineSnippet> to prove
                ownership of <InlineSnippet>{domainJson.name}</InlineSnippet>:
              </p>
              <div className="my-3 flex items-start justify-start space-x-10 rounded-md bg-muted p-2">
                <div>
                  <p className="font-bold text-sm">Type</p>
                  <p className="mt-2 font-mono text-sm">
                    {txtVerification.type}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-sm">Name</p>
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
                  <p className="font-bold text-sm">Value</p>
                  <p className="mt-2 break-all font-mono text-sm">
                    {txtVerification.value}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Warning: if you are using this domain for another site, setting
                this TXT record will transfer domain ownership away from that
                site and break it. Please exercise caution when setting this
                record.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              A TXT record may be required to verify domain ownership. The exact
              record values will appear here once DNS is configured.
            </p>
          )}
        </StepCardContent>
      </StepCard>
    </div>
  );
}
