"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

// TODO: create place to put into layout.tsx

export function Breadcrumbs() {
  const pathname = usePathname();
  const result = pathname.split("/").slice(3);

  return (
    <ul className="flex items-center">
      {result.map((path, i) => {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey:
          <Fragment key={i}>
            <li>{path}</li>
            {i !== result.length - 1 ? (
              <ChevronRight className="text-muted-foreground mx-2 h-3 w-3" />
            ) : null}
          </Fragment>
        );
      })}
    </ul>
  );
}
