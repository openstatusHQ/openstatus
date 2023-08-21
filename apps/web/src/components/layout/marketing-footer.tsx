import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";

interface Props {
  className?: string;
}

export function MarketingFooter({ className }: Props) {
  return (
    <footer className={cn("w-full", className)}>
      <Shell className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-foreground font-semibold">Twitter</p>
          <FooterLink
            href="https://twitter.com/thibaultleouay"
            label="@thibaultleouay"
          />
          <FooterLink href="https://twitter.com/mxkaske" label="@mxkaske" />
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-foreground font-semibold">Community</p>
          <FooterLink
            href="https://github.com/openstatushq/openstatus"
            label="GitHub"
          />
          <FooterLink href="https://discord.gg/dHD4JtSfsn" label="Discord" />
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-foreground font-semibold">Resources</p>
          <FooterLink href="https://status.openstatus.dev" label="Status" />
          <FooterLink href="/blog" label="Blog" />
          <FooterLink href="https://docs.openstatus.dev" label="Docs" />
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-foreground font-semibold">Legal</p>
          <FooterLink href="/legal/terms" label="Terms" />
          <FooterLink href="/legal/privacy" label="Privacy" />
        </div>
      </Shell>
    </footer>
  );
}

function FooterLink({ href, label }: Record<"href" | "label", string>) {
  const isExternal = href.startsWith("http");

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
