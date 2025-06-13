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
import { type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavBreadcrumbProps {
  items: (
    | {
        type: "link";
        label: string;
        href: string;
      }
    | {
        type: "page";
        label: string;
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
  const value = pathname.split("/").pop();

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, i) => (
          <Fragment key={i}>
            <BreadcrumbItem>
              {item.type === "link" ? (
                <BreadcrumbLink className="hidden md:block" asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : null}
              {item.type === "page" ? (
                <BreadcrumbPage className="hidden md:block max-w-[120px] truncate lg:max-w-[200px]">
                  {item.label}
                </BreadcrumbPage>
              ) : null}
              {item.type === "select" ? (
                <Select
                  value={value}
                  onValueChange={(value) => {
                    router.push(value);
                  }}
                >
                  <SelectTrigger
                    id="select-option"
                    className="text-foreground [&>span_svg]:text-muted-foreground/80 [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span_svg]:shrink-0"
                    aria-label="Select option"
                  >
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {item.items.map((item, i) => (
                      <SelectItem key={i} value={item.value}>
                        <item.icon size={16} aria-hidden="true" />
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
