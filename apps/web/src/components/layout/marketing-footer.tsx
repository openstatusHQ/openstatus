import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { socialsConfig } from "@/config/socials";
import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";
import { BrandName } from "./brand-name";
import { SocialIconButton } from "./social-icon-button";
import { StatusWidgetContainer } from "./status-widget-suspense";

interface Props {
  className?: string;
}

export function MarketingFooter({ className }: Props) {
  return (
    <footer className={cn("w-full", className)}>
      <Shell className="grid gap-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-3">
            <div>
              <BrandName />
              <p className="mt-2 max-w-md font-light text-muted-foreground text-sm">
                We are on a mission to provide a reliable, easy and fast way to
                monitor the performance of your APIs and websites.
                <br />
                <span className="underline decoration-dotted underline-offset-2">
                  Speed Matters
                </span>
              </p>
            </div>
            <StatusWidgetContainer slug="status" />
          </div>
          <div className="order-2 flex flex-col gap-3 text-sm">
            <p className="font-semibold text-foreground">Resources</p>
            <FooterLink href="/blog" label="Blog" />
            <FooterLink href="/pricing" label="Pricing" />
            <FooterLink href="https://docs.openstatus.dev" label="Docs" />
            <FooterLink href="/oss-friends" label="OSS Friends" />
            <FooterLink href="/status" label="External Providers Monitoring" />
          </div>
          <div className="order-3 flex flex-col gap-3 text-sm">
            <p className="font-semibold text-foreground">Company</p>
            <FooterLink href="/about" label="About" />
            <FooterLink href="/changelog" label="Changelog" />
            <FooterLink href="/legal/terms" label="Terms" />
            <FooterLink href="/legal/privacy" label="Privacy" />
          </div>
          <div className="order-3 flex flex-col gap-3 text-sm">
            <p className="font-semibold text-foreground">Tools</p>
            <FooterLink href="/play/checker" label="Speed Checker" />
            <FooterLink href="/play/curl" label="cURL Builder" />
            <FooterLink href="https://openstat.us" label="All Status Codes" />
            <FooterLink
              href="https://light.openstatus.dev"
              label="Vercel Edge Ping"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {socialsConfig.map(({ title, href, icon }) => (
              <SocialIconButton key={title} {...{ href, icon, title }} />
            ))}
          </div>
          <div className="text-right md:text-left">
            <ThemeToggle />
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

  const externalProps = isExternal
    ? {
        target: "_blank",
        rel: "noreferrer",
      }
    : {};

  return (
    <Link
      className="flex w-fit flex-wrap items-center gap-1 text-muted-foreground underline underline-offset-4 hover:text-foreground hover:no-underline"
      href={href}
      {...externalProps}
    >
      {label}
      {isExternal ? <ArrowUpRight className="h-4 w-4 flex-shrink-0" /> : null}
    </Link>
  );
}
