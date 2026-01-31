"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment } from "react";

interface NavBreadcrumbProps {
  items: (
    | {
        type: "link";
        label: string;
        href: string;
        icon?: LucideIcon;
      }
    | {
        type: "page";
        label: string;
        icon?: LucideIcon;
      }
    | {
        type: "select";
        items: { value: string; label: string; icon: LucideIcon }[];
      }
  )[];
}

export function NavBreadcrumb({ items }: NavBreadcrumbProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Find the select item in the breadcrumb
  const selectItem = items.find((item) => item.type === "select");

  // Get pathname segments
  const segments = pathname.split("/").filter(Boolean);

  // Find the first segment that matches a select item value, or fall back to last segment
  const value = selectItem
    ? segments.find((segment) =>
        selectItem.items.some((item) => item.value === segment),
      ) ?? segments[segments.length - 1]
    : segments[segments.length - 1];

  // Find the index of the current value in segments to construct base path
  const valueIndex = segments.indexOf(value);
  const basePath =
    valueIndex >= 0 ? `/${segments.slice(0, valueIndex).join("/")}` : pathname;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbSeparator className="hidden md:block" />
        {items.map((item, i) => (
          <Fragment key={`${item.type}-${i}`}>
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
                <BreadcrumbPage className=" hidden max-w-[120px] truncate font-commit-mono tracking-tight md:block lg:max-w-[200px] ">
                  <span className="flex items-center gap-1.5">
                    {item.icon && (
                      <item.icon
                        size={16}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                    )}

                    {item.label}
                  </span>
                </BreadcrumbPage>
              ) : null}
              {item.type === "select" ? (
                <Select
                  value={value}
                  onValueChange={(newValue) => {
                    router.push(`${basePath}/${newValue}`);
                  }}
                >
                  <SelectTrigger
                    id="select-option"
                    className="font-commit-mono text-foreground tracking-tight [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span_svg]:shrink-0 [&>span_svg]:text-muted-foreground/80"
                    aria-label="Select option"
                  >
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {item.items.map((item, i) => (
                      <SelectItem
                        key={i}
                        value={item.value}
                        className="font-commit-mono tracking-tight"
                      >
                        <item.icon
                          size={16}
                          aria-hidden="true"
                          className="shrink-0"
                        />
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
