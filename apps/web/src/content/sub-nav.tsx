"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { CopyButton } from "./copy-button";

export function SubNav({ className, ...props }: React.ComponentProps<"div">) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(0, -1);

  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    >
      <div className="prose px-4 text-muted-foreground">
        {segments.map((segment, index) => (
          <Fragment key={segment}>
            <Link href={`/${segments.slice(0, index + 1).join("/")}`}>
              {segment}
            </Link>
            {index < segments.length - 1 ? <span>{" | "}</span> : null}
          </Fragment>
        ))}
      </div>
      <CopyButton
        copyText={typeof window !== "undefined" ? window.location.href : ""}
      />
    </div>
  );
}
