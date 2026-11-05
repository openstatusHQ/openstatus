"use client";

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
 */
export function PlaceholderPicker({
  id,
  title,
  description,
  items,
  empty,
}: {
  id: string;
  title: string;
  description: string;
  items: Item[];
  empty: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The server never sees the hash, so it's read after mount.
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    setHash(window.location.hash);
  }, []);

  const search = searchParams.size ? `?${searchParams}` : "";
  const hrefFor = (itemId: number) =>
    `${pathname.replace(/^(\/[^/]+)\/_(?=\/|$)/, `$1/${itemId}`)}${search}${hash ?? ""}`;

  const only = items.length === 1 ? items[0] : undefined;
  const redirect = only && hash !== null ? hrefFor(only.id) : null;
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (only) return null;

  return (
    <SectionGroup>
      <Section id={id}>
        <SectionHeader>
          <SectionTitle>{title}</SectionTitle>
          <SectionDescription>{description}</SectionDescription>
        </SectionHeader>
        {items.length === 0 ? (
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
