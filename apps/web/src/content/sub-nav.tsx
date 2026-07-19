"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { cn } from "../lib/utils";
import { CopyDropdownButton } from "./copy-button";

export function SubNav({ className, ...props }: React.ComponentProps<"div">) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(0, -1);

  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    >
      <div className="text-muted-foreground min-w-0 truncate px-4">
        {segments.map((segment, index) => (
          <Fragment key={segment}>
            <Link
              href={`/${segments.slice(0, index + 1).join("/")}`}
              className="ease hover:text-foreground transition-colors duration-150 motion-reduce:transition-none"
            >
              {segment.split("-").join(" ")}
            </Link>
            {index < segments.length - 1 ? (
              <span className="text-muted-foreground">{" | "}</span>
            ) : null}
          </Fragment>
        ))}
      </div>
      <CopyDropdownButton />
    </div>
  );
}
