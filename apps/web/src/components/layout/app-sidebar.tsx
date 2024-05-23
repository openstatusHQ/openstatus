"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import type { Page } from "@/config/pages";
import { ProBanner } from "../billing/pro-banner";
import { AppLink } from "./app-link";

export function AppSidebar({ page }: { page?: Page }) {
  const selectedSegment = useSelectedLayoutSegment();

  if (!page) return null;

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="grid gap-2">
        <p className="hidden px-3 font-medium text-foreground text-lg lg:block">
          {page?.title}
        </p>
        <ul className="grid gap-2">
          {page?.children?.map(({ title, segment, icon, disabled }) => {
            return (
              <li key={title} className="w-full">
                <AppLink
                  label={title}
                  href={`./${segment}`}
                  disabled={disabled}
                  active={segment === selectedSegment}
                  icon={icon}
                />
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hidden lg:block">
        <ProBanner />
      </div>
    </div>
  );
}
