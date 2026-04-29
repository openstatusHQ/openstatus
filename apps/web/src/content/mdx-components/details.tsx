import React from "react";
import { slugify } from "./heading";

export function Details({
  children,
  summary,
  open = false,
}: {
  children: React.ReactNode;
  summary: string;
  open?: boolean;
}) {
  return (
    <details id={slugify(summary)} open={open}>
      <summary>{summary}</summary>
      {React.isValidElement(children)
        ? // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          React.cloneElement(children, { hidden: "until-found" } as any)
        : children}
    </details>
  );
}
