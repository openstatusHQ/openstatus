import { GlobeIcon } from "lucide-react";

import { EntityCard } from "./entity-card";

type Output = {
  items?: Array<{ id: number; title: string; slug: string }>;
};

export function ListStatusPagesResult({ output }: { output: Output }) {
  const items = output?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-background p-3 text-muted-foreground text-sm">
        No status pages.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((p) => (
        <EntityCard
          key={p.id}
          icon={GlobeIcon}
          title={p.title}
          meta={
            <>
              <code className="font-mono">{p.slug}</code>
              <span className="mx-1.5">·</span>
              <span>ID {p.id}</span>
            </>
          }
        />
      ))}
    </div>
  );
}
