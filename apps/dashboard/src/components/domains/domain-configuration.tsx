"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { Note } from "@/components/common/note";
import { getSubdomain } from "@/lib/domains";
import { CircleCheck } from "lucide-react";
import DomainStatusIcon from "./domain-status-icon";
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

// FIXME: add loading state!
export default function DomainConfiguration({ domain }: { domain: string }) {
  const { status, domainJson } = useDomainStatus(domain);

  if (!status || !domainJson) return null;

  if (status === "Valid Configuration")
    return (
      <Note color="success">
        <CircleCheck />
        Your domain is configured and you can use it to access your status page.
      </Note>
    );

  const subdomain =
    domainJson?.name && domainJson?.apexName
      ? getSubdomain(domainJson.name, domainJson.apexName)
      : null;

  const txtVerification =
    (status === "Pending Verification" &&
      domainJson?.verification?.find((x) => x.type === "TXT")) ||
    null;

  return (
    <div>
      <div className="mb-4 flex items-center space-x-2">
        <DomainStatusIcon status={status} />
        <p className="font-semibold">{status}</p>
      </div>
      {txtVerification ? (
        <>
          <p className="text-sm">
            Please set the following TXT record on{" "}
            <InlineSnippet>{domainJson.apexName}</InlineSnippet> to prove
            ownership of <InlineSnippet>{domainJson.name}</InlineSnippet>:
          </p>
          <div className="my-5 flex items-start justify-start space-x-10 rounded-md bg-muted p-2">
            <div>
              <p className="font-bold text-sm">Type</p>
              <p className="mt-2 font-mono text-sm">{txtVerification.type}</p>
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
                    <p className="mt-2 font-mono text-sm">76.76.21.21</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm">TTL</p>
                    <p className="mt-2 font-mono text-sm">86400</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="font-bold text-sm">Value</p>
                <p className="mt-2 font-mono text-sm">cname.vercel-dns.com</p>
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
                    <p className="mt-2 font-mono text-sm">
                      {"cname.vercel-dns.com"}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-sm">TTL</p>
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
