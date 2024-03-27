"use client";

import { cn } from "@/lib/utils";
import { Separator } from "@openstatus/ui";
import type { LinkProps } from "next/link";
import Link from "next/link";
import type { HTMLAttributes } from "react";
import type { ReactNode } from "react";

export interface TabsContainerProps extends HTMLAttributes<HTMLDivElement> {
  hideSeparator?: boolean;
}

export function TabsContainer({
  className,
  children,
  hideSeparator = false,
}: TabsContainerProps) {
  return (
    <nav className={cn(className)}>
      <div className="flex w-full items-center overflow-x-auto">
        <ul className="flex flex-row">{children}</ul>
      </div>
      {/* TODO: move into border-b instead to allow overwrite via className `border-b-0`? */}
      {hideSeparator ? null : <Separator />}
    </nav>
  );
}

export interface TabsLinkProps extends LinkProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}

export function TabsLink({
  children,
  active,
  className,
  disabled,
  ...props
}: TabsLinkProps) {
  return (
    <li
      className={cn("flex shrink-0 list-none border-transparent border-b-2", {
        "border-primary": active,
        "pointer-events-none opacity-70": disabled,
      })}
    >
      <Link
        className={cn(
          "rounded-md px-4 pt-2 pb-3 font-medium text-muted-foreground text-sm hover:text-primary",
          {
            "text-primary": active,
          },
          className,
        )}
        {...props}
      >
        {children}
      </Link>
    </li>
  );
}
