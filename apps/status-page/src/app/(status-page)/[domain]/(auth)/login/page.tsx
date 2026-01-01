"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { SectionMagicLink } from "./_components/section-magic-link";
import { SectionPassword } from "./_components/section-password";

export default function AuthPage() {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (page?.accessType === "password") {
    return <SectionPassword />;
  }

  if (page?.accessType === "email-domain") {
    return <SectionMagicLink />;
  }

  return notFound();
}
