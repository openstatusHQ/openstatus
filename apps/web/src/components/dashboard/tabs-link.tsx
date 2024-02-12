"use client";

import * as React from "react";
import type { LinkProps } from "next/link";
import Link from "next/link";

import { Separator } from "@openstatus/ui";

import { cn } from "@/lib/utils";

export interface TabsContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
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
      {/* TODO: move into border-b instead? */}
      {hideSeparator ? null : <Separator />}
    </nav>
  );
}

export interface TabsLinkProps extends LinkProps {
  children: React.ReactNode;
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
      className={cn("flex shrink-0 list-none border-b-2 border-transparent", {
        "border-primary": active,
        "pointer-events-none opacity-70": disabled,
      })}
    >
      <Link
        className={cn(
          "text-muted-foreground hover:text-primary rounded-md px-4 pb-3 pt-2 text-sm font-medium",
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
