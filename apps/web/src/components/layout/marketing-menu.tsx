"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";

import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui";

import { marketingPagesConfig } from "@/config/pages";
import { socialsConfig } from "@/config/socials";
import { AppLink } from "./app-link";
import { LoginButton } from "./login-button";
import { SocialIconButton } from "./social-icon-button";

export function MarketingMenu() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, []); // remove searchParams if not needed

  return (
    <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          aria-label="menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="ml-2 text-left">Menu</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col justify-between gap-4">
          <ul className="grid gap-1">
            {/* biome-ignore lint/correctness/noUnusedVariables: <explanation> */}
            {marketingPagesConfig.map(({ href, title, segment }) => {
              const isExternal = href.startsWith("http");
              const externalProps = isExternal ? { target: "_blank" } : {};
              const isActive = pathname.startsWith(href);
              return (
                <li key={href} className="w-full">
                  <AppLink
                    href={href}
                    label={title}
                    active={isActive}
                    {...externalProps}
                  />
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between gap-2">
            <ul className="flex flex-wrap gap-2">
              {socialsConfig.map((props, _i) => (
                <li key={props.title}>
                  <SocialIconButton {...props} />
                </li>
              ))}
            </ul>
            <LoginButton variant="outline" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
