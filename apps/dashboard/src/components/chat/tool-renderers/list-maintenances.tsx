import { WrenchIcon } from "lucide-react";

import { EntityCard } from "./entity-card";

type Item = {
  id: number;
  title: string;
  message: string;
  from: string;
  to: string;
  pageId: number | null;
  pageComponentIds: number[];
};

type Output = {
  items?: Item[];
};

export function ListMaintenancesResult({ output }: { output: Output }) {
  const items = output?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-background p-3 text-muted-foreground text-sm">
        No maintenance windows.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((m) => (
        <EntityCard
          key={m.id}
          icon={WrenchIcon}
          title={m.title}
          meta={
            <>
              <span>ID {m.id}</span>
              <span className="mx-1.5">·</span>
              <span>{formatRange(m.from, m.to)}</span>
              {m.pageId !== null ? (
                <>
                  <span className="mx-1.5">·</span>
                  <span>page #{m.pageId}</span>
                </>
              ) : null}
            </>
          }
        />
      ))}
    </div>
  );
}

function formatRange(from: string, to: string): string {
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) {
    return `${from} → ${to}`;
  }
  return `${f.toLocaleString()} → ${t.toLocaleString()}`;
}
