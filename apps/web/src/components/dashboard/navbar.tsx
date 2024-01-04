"use client";

import * as React from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { Separator } from "@openstatus/ui";

import { cn } from "@/lib/utils";

type Props = {
  // TODO: add disabled state for pro/hobby plan users
  navigation: { label: string; href: string; segment: string | null }[];
  className?: string;
};

export const Navbar = ({ navigation, className }: Props) => {
  const selectedSegment = useSelectedLayoutSegment();

  return (
    <nav className={cn(className)}>
      <div className="flex w-full items-center overflow-x-auto">
        <ul className="flex flex-row gap-4">
          {navigation.map(({ label, href, segment }) => {
            const active = segment === selectedSegment;
            return (
              <li
                key={label}
                className={cn(
                  "flex shrink-0 list-none border-b-2 border-transparent p-2 ",
                  {
                    "border-primary ": active,
                  },
                )}
              >
                <Link
                  href={href}
                  className={cn(
                    "text-muted-foreground hover:text-primary -mx-3 rounded-md px-3 py-2 text-sm font-medium",
                    {
                      "text-primary": active,
                    },
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <Separator />
    </nav>
  );
};
