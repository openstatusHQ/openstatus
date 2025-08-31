import { Footer } from "@/components/nav/footer";
import { Header } from "@/components/nav/header";
import {
  FloatingButton,
  StatusPageProvider,
} from "@/components/status-page/floating-button";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  return (
    <Hydrate params={params}>
      <StatusPageProvider>
        <div className="flex min-h-screen flex-col gap-4">
          <Header className="w-full border-b" />
          <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-2">
            {children}
          </main>
          <Footer className="w-full border-t" />
        </div>
        <FloatingButton />
      </StatusPageProvider>
    </Hydrate>
  );
}

async function Hydrate({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusPage.get.queryOptions({ slug: (await params).domain }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
