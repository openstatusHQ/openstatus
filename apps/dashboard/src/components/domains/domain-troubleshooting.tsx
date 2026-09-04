"use client";

import { ExternalLink } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { useState } from "react";

import { Link } from "@/components/common/link";

import { InlineSnippet } from "./domain-configuration";

const tools = [
  {
    label: "Let's Debug",
    href: (domain: string) =>
      `https://letsdebug.net/${encodeURIComponent(domain)}`,
    description: "Diagnose Let's Encrypt issuance failures.",
  },
  {
    label: "DNSViz",
    href: (domain: string) =>
      `https://dnsviz.net/d/${encodeURIComponent(domain)}/dnssec/`,
    description: "Visualize DNS and DNSSEC behavior.",
  },
  {
    label: "DNS Checker",
    href: (domain: string) =>
      `https://dnschecker.org/#A/${encodeURIComponent(domain)}`,
    description: "Check global DNS propagation.",
  },
  {
    label: "Google Public DNS",
    href: (domain: string) =>
      `https://dns.google/query?name=${encodeURIComponent(domain)}&rr_type=A`,
    description: "Resolve records from a public resolver.",
  },
] as const;

export function DomainTroubleshooting({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full cursor-pointer rounded-xl">
        <Card className="gap-0 border-dashed py-0 text-left shadow-none">
          <CardHeader className="px-4 py-3 select-none">
            <CardTitle className="text-sm">Troubleshooting</CardTitle>
            <CardDescription>
              If the configuration stays pending or invalid for more than a few
              minutes, one of these is usually the cause.
            </CardDescription>
          </CardHeader>
          <CollapsibleContent
            onClick={(e) => e.stopPropagation()}
            className="cursor-auto"
          >
            <CardContent className="space-y-4 px-4 pb-4">
              <ul className="list-disc space-y-2 pl-5 text-sm">
                <li>
                  <span className="font-medium">
                    CAA records block Let's Encrypt.
                  </span>{" "}
                  If your domain has any <InlineSnippet>CAA</InlineSnippet>{" "}
                  records, one of them must allow{" "}
                  <InlineSnippet>letsencrypt.org</InlineSnippet>. Check with{" "}
                  <InlineSnippet>{`dig CAA ${domain}`}</InlineSnippet>.
                </li>
                <li>
                  <span className="font-medium">
                    Stale <InlineSnippet>_acme-challenge</InlineSnippet> record.
                  </span>{" "}
                  A leftover TXT record from a previous provider can block
                  issuance. Check with{" "}
                  <InlineSnippet>{`dig TXT _acme-challenge.${domain}`}</InlineSnippet>
                  .
                </li>
                <li>
                  <span className="font-medium">
                    <InlineSnippet>AAAA</InlineSnippet> record pointing
                    elsewhere.
                  </span>{" "}
                  IPv6 is not supported for custom domains; remove any{" "}
                  <InlineSnippet>AAAA</InlineSnippet> records on the domain.
                </li>
                <li>
                  <span className="font-medium">
                    DNS scripting or proxying interferes with the challenge.
                  </span>{" "}
                  Features like Bunny DNS scripts or Cloudflare's orange-cloud
                  proxy can return different answers to the certificate
                  authority than to your browser. Disable them for the record
                  and retry.
                </li>
                <li>
                  <span className="font-medium">CNAME copied incorrectly.</span>{" "}
                  Don't include the domain in the{" "}
                  <InlineSnippet>Name</InlineSnippet> field, and keep the
                  trailing dot in the value if your provider requires it.
                </li>
                <li>
                  <span className="font-medium">
                    DNS hasn't propagated yet.
                  </span>{" "}
                  Changes can take up to an hour (longer if the previous TTL was
                  high).
                </li>
              </ul>
              <div className="space-y-2">
                <p className="text-sm font-medium">Run external diagnostics</p>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool) => (
                    <Button
                      key={tool.label}
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link
                        href={tool.href(domain)}
                        target="_blank"
                        rel="noreferrer"
                        title={tool.description}
                      >
                        {tool.label}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
