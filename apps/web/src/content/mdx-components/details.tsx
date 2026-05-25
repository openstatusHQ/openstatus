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
      {children}
    </details>
  );
}
