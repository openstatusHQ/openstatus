import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { Navbar } from "@/components/dashboard/navbar";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; id: string };
}) {
  const id = params.id;

  const page = await api.page.getPageById.query({
    id: Number(id),
  });

  if (!page) {
    return notFound();
  }

  const navigation = [
    {
      label: "Settings",
      href: `/app/${params.workspaceSlug}/status-pages/${id}/edit`,
      segment: "edit",
    },
    {
      label: "Domain",
      href: `/app/${params.workspaceSlug}/status-pages/${id}/domain`,
      segment: "domain",
    },
    {
      label: "Subscribers",
      href: `/app/${params.workspaceSlug}/status-pages/${id}/subscribers`,
      segment: "subscribers",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      <Header
        title={page.title}
        description={page.description}
        actions={
          <Button variant="outline" asChild>
            <Link href={`https://${page.slug}.openstatus.dev`}>Visit</Link>
          </Button>
        }
      />
      <Navbar className="col-span-full" navigation={navigation} />
      {children}
    </div>
  );
}
