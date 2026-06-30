"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { cn } from "../lib/utils";
import { CopyDropdownButton } from "./copy-button";

export function DocsSubNav({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(0, -1);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 font-mono",
        className,
      )}
      {...props}
    >
      <div className="text-muted-foreground">
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
      <CopyDropdownButton className="p-0" />
    </div>
  );
}
