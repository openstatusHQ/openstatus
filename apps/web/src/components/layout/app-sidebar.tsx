"use client";

import { useParams } from "next/navigation";

import { pagesConfig } from "@/config/pages";
import { ProBanner } from "../billing/pro-banner";
import { SelectWorkspace } from "../workspace/select-workspace";
import { AppLink } from "./app-link";

export function AppSidebar() {
  const params = useParams();

  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <ul className="grid gap-1">
        {pagesConfig.map(({ title, href, icon, disabled }) => {
          return (
            <li key={title} className="w-full">
              <AppLink
                label={title}
                href={`/app/${params?.workspaceSlug}${href}`}
                disabled={disabled}
                segment={href.replace("/", "")}
                icon={icon}
              />
            </li>
          );
        })}
      </ul>
      <ul className="grid gap-2">
        {/* <li className="w-full">Help & Support</li> */}
        <li className="w-full">
          <ProBanner />
        </li>
        <li className="w-full">
          <SelectWorkspace />
        </li>
      </ul>
    </div>
  );
}
