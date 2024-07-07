"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@openstatus/ui";

import { marketingPagesConfig } from "@/config/pages";
import { cn } from "@/lib/utils";
import { BrandName } from "./brand-name";
import { LoginButton } from "./login-button";
import { MarketingMenu } from "./marketing-menu";
import { useWindowScroll } from "@/hooks/use-window-scroll";
import { useMemo } from "react";

interface Props {
  className?: string;
}

export function MarketingHeader({ className }: Props) {
  const pathname = usePathname();
  const [{ y }] = useWindowScroll();
  const isScroll = useMemo(() => y && y > 0, [y]);

  return (
    <header
      className={cn(
        "sticky top-6 z-10 grid w-full grid-cols-2 gap-2 border border-transparent md:grid-cols-5",
        {
          "rounded-full border-border backdrop-blur-lg": isScroll,
        },
        className
      )}
    >
      <div className="flex items-center pl-3 md:col-span-1 md:pl-6">
        <BrandName />
      </div>
      <div
        className={cn(
          "mx-auto hidden items-center justify-center border border-transparent px-2 md:col-span-3 md:flex md:gap-1",
          { "rounded-full border-border backdrop-blur-lg": !isScroll }
        )}
      >
        {marketingPagesConfig.map(({ href, title, segment }) => {
          const isExternal = href.startsWith("http");
          const externalProps = isExternal ? { target: "_blank" } : {};
          const isActive = pathname.startsWith(href);
          return (
            <Button
              key={segment}
              variant="link"
              className={isActive ? "font-semibold" : undefined}
              asChild
            >
              <Link href={href} {...externalProps}>
                {title}
              </Link>
            </Button>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-3 md:col-span-1">
        <div className="block md:hidden">
          <MarketingMenu />
        </div>
        <LoginButton />
      </div>
    </header>
  );
}
