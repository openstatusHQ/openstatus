import { notFound } from "next/navigation";

import { Shell } from "@/components/dashboard/shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/trpc/server";
import NavigationLink from "./_components/navigation-link";
import { SubscribeButton } from "./_components/subscribe-button";

type Props = {
  params: { domain: string };
  children: React.ReactNode;
};

export default async function StatusPageLayout({ children, params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

  return (
    <div className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <header className="mx-auto w-full max-w-xl">
        <Shell className="mx-auto flex items-center justify-between gap-4 p-2 px-2 md:p-3">
          <div className="hidden w-[100px] md:block" />
          <div className="flex items-center gap-2">
            <NavigationLink slug={null}>Status</NavigationLink>
            <NavigationLink slug="incidents">Incidents</NavigationLink>
          </div>
          <div className="w-[100px] text-end">
            {page.workspacePlan !== "free" ? (
              <SubscribeButton slug={params.domain} />
            ) : null}
          </div>
        </Shell>
      </header>
      <main className="flex h-full w-full flex-1 flex-col">
        <Shell className="mx-auto h-full max-w-xl flex-1 px-4 py-4">
          {children}
        </Shell>
      </main>
      <footer className="z-10 mx-auto flex w-full max-w-xl items-center justify-between">
        <div />
        <p className="text-muted-foreground text-center text-sm">
          powered by{" "}
          <a
            href="https://www.openstatus.dev"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            openstatus.dev
          </a>
        </p>
        <ThemeToggle />
      </footer>
    </div>
  );
}
