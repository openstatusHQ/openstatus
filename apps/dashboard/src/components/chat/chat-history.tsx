"use client";

import { Link } from "@/components/common/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { useTRPC } from "@/lib/trpc/client";

const MAX_VISIBLE = 5;

/**
 * Recent chat sessions list shown on the empty `/chat` landing page.
 * Reads from the same `chatSession.list` query the sidebar already uses,
 * so nav and landing-page data stay in sync via React-Query cache.
 */
export function ChatHistory() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.chatSession.list.queryOptions());
  const recent = (data ?? []).slice(0, MAX_VISIBLE);

  if (recent.length === 0) return null;

  return (
    <div className="w-full max-w-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-muted-foreground text-xs uppercase tracking-wide">
          Recent
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {recent.map((s) => (
          <li key={s.id}>
            <Link
              href={`/chat/${s.id}`}
              className="flex items-center justify-between gap-3 text-muted-foreground text-sm hover:text-foreground"
            >
              <span className="truncate">{s.title}</span>
              <span className="shrink-0 font-commit-mono text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(s.updatedAt), {
                  addSuffix: true,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
