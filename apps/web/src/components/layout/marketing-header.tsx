"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@openstatus/ui";

import { marketingPagesConfig } from "@/config/pages";
import { cn } from "@/lib/utils";
import { BrandName } from "./brand-name";
import { LoginButton } from "./login-button";
import { MarketingMenu } from "./marketing-menu";
import { useWindowScroll } from "@/hooks/use-window-scroll";
import * as React from "react";
import { Icons, type ValidIcon } from "../icons";

interface Props {
  className?: string;
}

export function MarketingHeader({ className }: Props) {
  const pathname = usePathname();
  const [{ y }] = useWindowScroll();
  const isScroll = React.useMemo(() => y && y > 0, [y]);

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
          "mx-auto hidden items-center justify-center border border-transparent md:col-span-3 md:flex md:gap-1",
          { "rounded-full border-border backdrop-blur-lg": !isScroll }
        )}
      >
        <NavigationMenu>
          <NavigationMenuList>
            {marketingPagesConfig.map((page) => {
              const { href, title, segment, children } = page;
              if (!children) {
                return (
                  <NavigationMenuItem>
                    <Link href={href} legacyBehavior passHref>
                      <NavigationMenuLink
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "h-9 rounded-full bg-transparent hover:bg-accent/50"
                        )}
                      >
                        {title}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                );
              }

              return (
                <NavigationMenuItem key={href}>
                  <NavigationMenuTrigger className="h-9 rounded-full bg-transparent hover:bg-transparent">
                    {title}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {children?.map((item) => {
                        const isExternal = item.href.startsWith("http");
                        const externalProps = isExternal
                          ? { target: "_blank" }
                          : {};
                        const isActive = pathname.startsWith(item.href);
                        return (
                          <ListItem
                            key={item.title}
                            title={item.title}
                            href={item.href}
                            icon={item.icon}
                          >
                            {item.description}
                          </ListItem>
                        );
                      })}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>
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

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & LinkProps & { icon: ValidIcon }
>(({ className, title, children, icon, ...props }, ref) => {
  // TODO: if external, add Arrow-Right-Up Icon
  const Icon = Icons[icon];
  return (
    <li className="group">
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          className={cn(
            "flex gap-3 select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="self-start rounded-md border p-2 group-hover:bg-background">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {children}
            </p>
          </div>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
