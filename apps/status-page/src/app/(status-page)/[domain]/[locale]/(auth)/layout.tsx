import { Footer } from "@/components/nav/footer";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const queryClient = getQueryClient();
  const { domain } = await params;
  await queryClient.prefetchQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  return (
    <Suspense>
      <div className="flex min-h-screen flex-col gap-4">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2">
          {children}
        </main>
        <Footer className="w-full border-t" />
      </div>
    </Suspense>
  );
}
