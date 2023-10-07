import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { StatusWidget } from "@/components/status-widget";
import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";

interface Props {
  className?: string;
}

export function MarketingFooter({ className }: Props) {
  return (
    <footer className={cn("w-full", className)}>
      <Shell className="grid gap-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="order-4 md:order-1">
            <StatusWidget slug="status" />
          </div>
          <div className="order-1 flex flex-col gap-3 text-sm md:order-2">
            <p className="text-foreground font-semibold">Community</p>
            <FooterLink href="/github" label="GitHub" external />
            <FooterLink href="/discord" label="Discord" external />
            <FooterLink href="https://twitter.com/openstatusHQ" label="X" />
          </div>
          <div className="order-2 flex flex-col gap-3 text-sm md:order-3">
            <p className="text-foreground font-semibold">Resources</p>
            <FooterLink href="/blog" label="Blog" />
            <FooterLink href="/changelog" label="Changelog" />
            <FooterLink href="https://docs.openstatus.dev" label="Docs" />
            <FooterLink href="/oss-friends" label="OSS Friends" />
          </div>
          <div className="order-3 flex flex-col gap-3 text-sm md:order-4">
            <p className="text-foreground font-semibold">Legal</p>
            <FooterLink href="/legal/terms" label="Terms" />
            <FooterLink href="/legal/privacy" label="Privacy" />
          </div>
        </div>
      </Shell>
    </footer>
  );
}

interface FooterLinkProps {
  href: string;
  label: string;
  external?: boolean;
}

function FooterLink({ href, label, external = false }: FooterLinkProps) {
  const isExternal = external || href.startsWith("http");

  const LinkSlot = isExternal ? "a" : Link;

  const externalProps = isExternal
    ? {
        target: "_blank",
        rel: "noreferrer",
      }
    : {};

  return (
    <LinkSlot
      className="text-muted-foreground hover:text-foreground inline-flex items-center underline underline-offset-4 hover:no-underline"
      href={href}
      {...externalProps}
    >
      {label}
      {isExternal ? (
        <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0" />
      ) : null}
    </LinkSlot>
  );
}
