"use client";

import { useQuery } from "@tanstack/react-query";

import { NAV } from "@/config/nav";
import { compareStatusPages } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";

import { NavGroupButton, NavGroupItem, NavGroupStatus } from "./nav-group";
import {
  NavPeek,
  NavPeekContent,
  NavPeekCreate,
  NavPeekEmpty,
  NavPeekItem,
  NavPeekItemMeta,
  NavPeekItemTitle,
  NavPeekList,
  NavPeekSearch,
  NavPeekTrigger,
} from "./nav-peek";

/** Sidebar item for status pages: pages with an open report first. */
export function NavStatusPagesItem() {
  const trpc = useTRPC();
  const { data: pages = [], isPending } = useQuery(
    trpc.page.list.queryOptions(),
  );

  const rows = [...pages].sort(compareStatusPages);
  const open = rows.filter((p) => p.hasActiveStatusReport).length;

  return (
    <NavGroupItem>
      <NavPeek>
        <NavPeekTrigger>
          <NavGroupButton item={NAV.statusPages} tooltip={false} />
        </NavPeekTrigger>
        {isPending ? null : pages.length ? (
          <NavPeekContent label="Status pages">
            <NavPeekSearch placeholder="Search status pages…" />
            <NavPeekList>
              {rows.map((p) => (
                <NavPeekItem
                  key={p.id}
                  value={`${p.title} #${p.id}`}
                  keywords={[p.slug, p.customDomain]}
                  href={`/status-pages/${p.id}/status-reports`}
                  variant={p.hasActiveStatusReport ? "warning" : "success"}
                >
                  <NavPeekItemTitle>{p.title}</NavPeekItemTitle>
                  {p.hasActiveStatusReport ? (
                    <NavPeekItemMeta variant="warning">
                      open report
                    </NavPeekItemMeta>
                  ) : null}
                </NavPeekItem>
              ))}
              <NavPeekEmpty>No match</NavPeekEmpty>
            </NavPeekList>
          </NavPeekContent>
        ) : (
          <NavPeekContent label="Status pages">
            <NavPeekCreate href="/status-pages/create">
              Create status page
            </NavPeekCreate>
          </NavPeekContent>
        )}
      </NavPeek>
      {pages.length ? (
        <NavGroupStatus
          variant={open ? "warning" : "success"}
          count={pages.length}
          label={`${pages.length} ${pages.length === 1 ? "status page" : "status pages"}, ${
            open
              ? `${open} ${open === 1 ? "has an" : "have an"} open report`
              : "no open reports"
          }`}
        />
      ) : null}
    </NavGroupItem>
  );
}
