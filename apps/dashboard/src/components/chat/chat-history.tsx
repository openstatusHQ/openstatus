"use client";

import { useSidebar } from "@openstatus/ui/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { Link } from "@/components/common/link";
import { useTRPC } from "@/lib/trpc/client";

const MAX_VISIBLE = 5;

export function ChatHistory() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.chatSession.list.queryOptions());
  const { setOpen } = useSidebar();
  const sessions = data ?? [];
  const recent = sessions.slice(0, MAX_VISIBLE);
  const extra = Math.max(sessions.length - MAX_VISIBLE, 0);

  if (recent.length === 0) return null;

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Recent
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {recent.map((s) => (
          <li key={s.id}>
            <Link
              href={`/chat/${s.id}`}
              className="text-muted-foreground hover:text-foreground flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">{s.title}</span>
              <span className="font-commit-mono text-muted-foreground shrink-0 text-xs">
                {formatDistanceToNow(new Date(s.updatedAt), {
                  addSuffix: true,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {extra > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground self-start font-mono text-xs"
        >
          {extra} more {extra === 1 ? "conversation" : "conversations"}
        </button>
      ) : null}
    </div>
  );
}
