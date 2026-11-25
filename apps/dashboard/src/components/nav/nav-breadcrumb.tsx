"use client";

import type { IconType } from "@openstatus/icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@openstatus/ui/components/ui/breadcrumb";
import Link from "next/link";
import { Fragment } from "react";

interface NavBreadcrumbProps {
  items: (
    | {
        type: "link";
        label: string;
        href: string;
        icon?: IconType;
      }
    | {
        type: "page";
        label: string;
        icon?: IconType;
      }
  )[];
}

export function NavBreadcrumb({ items }: NavBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbSeparator className="hidden md:block" />
        {items.map((item, i) => (
          <Fragment key={item.type === "link" ? item.href : item.label}>
            <BreadcrumbItem>
              {item.type === "link" ? (
                <BreadcrumbLink
                  className="hidden flex-nowrap items-center gap-1.5 md:flex"
                  asChild
                >
                  <Link
                    href={item.href}
                    className="font-commit-mono tracking-tight"
                  >
                    {item.icon && (
                      <item.icon
                        size={16}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                    )}
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              ) : null}
              {item.type === "page" ? (
                <BreadcrumbPage className="font-commit-mono hidden max-w-[120px] tracking-tight md:block lg:max-w-[200px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {item.icon && (
                      <item.icon
                        size={16}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </span>
                </BreadcrumbPage>
              ) : null}
            </BreadcrumbItem>
            {i < items.length - 1 && (
              <BreadcrumbSeparator className="hidden md:block" />
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
