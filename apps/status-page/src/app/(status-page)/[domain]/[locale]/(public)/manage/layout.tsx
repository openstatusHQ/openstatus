"use client";

import { useTRPC } from "@/lib/trpc/client";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@openstatus/ui/components/blocks/status-layout";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (!page) return null;

  return (
    <Status>
      <StatusHeader>
        <StatusTitle>{page.title}</StatusTitle>
        <StatusDescription>{page.description}</StatusDescription>
      </StatusHeader>
      <StatusContent>{children}</StatusContent>
    </Status>
  );
}
