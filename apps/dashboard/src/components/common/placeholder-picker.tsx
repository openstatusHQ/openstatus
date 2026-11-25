"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Link } from "@/components/common/link";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardGroup,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

type Item = { id: number; name: string; description?: string };

/**
 * Resolves `_` in shareable links like `/monitors/_/edit#retry-policy` to a
 * real id. One item redirects straight away; the hash is carried over.
 * `items` is `undefined` while the list loads; `error` shows a retry instead,
 * which stays up (disabled while `retrying`) until the list arrives.
 */
export function PlaceholderPicker({
  id,
  title,
  description,
  items,
  empty,
  error,
  retrying,
  onRetry,
}: {
  id: string;
  title: string;
  description: string;
  items: Item[] | undefined;
  empty: React.ReactNode;
  error?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The server never sees the hash, so it's read after mount and kept in
  // sync for the item links while the picker stays open.
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const query = searchParams.toString();
  const search = query ? `?${query}` : "";
  const hrefFor = (itemId: number) =>
    `${pathname.replace(/^(\/[^/]+)\/_(?=\/|$)/, `$1/${itemId}`)}${search}${hash ?? ""}`;

  const only = items?.length === 1 ? items[0] : undefined;
  const redirect = only && hash !== null ? hrefFor(only.id) : null;
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (only || (!items && !error)) return null;

  return (
    <SectionGroup>
      <Section id={id}>
        <SectionHeader>
          <SectionTitle>{title}</SectionTitle>
          <SectionDescription>{description}</SectionDescription>
        </SectionHeader>
        {!items ? (
          <EmptyStateContainer>
            <EmptyStateTitle>Couldn&apos;t load the list</EmptyStateTitle>
            <EmptyStateDescription>
              Something went wrong while loading. Try again.
            </EmptyStateDescription>
            {onRetry ? (
              <EmptyStateActions>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  disabled={retrying}
                >
                  {retrying ? "Retrying…" : "Retry"}
                </Button>
              </EmptyStateActions>
            ) : null}
          </EmptyStateContainer>
        ) : items.length === 0 ? (
          empty
        ) : (
          <ActionCardGroup>
            {items.map((item) => (
              <Link href={hrefFor(item.id)} key={item.id}>
                <ActionCard className="h-full w-full">
                  <ActionCardHeader>
                    <ActionCardTitle>{item.name}</ActionCardTitle>
                    {item.description ? (
                      <ActionCardDescription className="truncate">
                        {item.description}
                      </ActionCardDescription>
                    ) : null}
                  </ActionCardHeader>
                </ActionCard>
              </Link>
            ))}
          </ActionCardGroup>
        )}
      </Section>
    </SectionGroup>
  );
}
