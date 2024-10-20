"use client";

import { useParams, useSelectedLayoutSegment } from "next/navigation";

import type { Page } from "@/config/pages";
import { ProBanner } from "../billing/pro-banner";
import { AppLink } from "./app-link";

function replacePlaceholders(
  template: string,
  values: { [key: string]: string },
): string {
  return template.replace(/\[([^\]]+)\]/g, (_, key) => {
    return values[key] || `[${key}]`;
  });
}

export function AppSidebar({ page }: { page?: Page }) {
  const params = useParams<Record<string, string>>();
  const selectedSegment = useSelectedLayoutSegment();

  if (!page) return null;

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="grid gap-2">
        <p className="hidden px-3 font-medium text-foreground text-lg lg:block">
          {page?.title}
        </p>
        <ul className="grid gap-2">
          {page?.children?.map(({ title, segment, icon, disabled, href }) => {
            const prefix = `/app/${params.workspaceSlug}`;
            return (
              <li key={title} className="w-full">
                <AppLink
                  label={title}
                  href={`${prefix}${replacePlaceholders(href, params)}`}
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
