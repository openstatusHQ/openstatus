import { notFound } from "next/navigation";

import { api } from "@/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; id: string };
}) {
  const id = params.id;

  const monitor = await api.incident.getIncidentById.query({
    id: Number(id),
  });

  if (!monitor) {
    return notFound();
  }

  return <div className="grid grid-cols-1 gap-6 md:gap-8">{children}</div>;
}
