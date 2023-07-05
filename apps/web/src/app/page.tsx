import Link from "next/link";

import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getResponseListData } from "@/lib/tb";
import { HeroForm } from "./_components/hero-form";
import { TableInputContainer } from "./_components/table-input-container";

export default async function Page() {
  const data = await getResponseListData({ siteId: "openstatus" });

  return (
    <main className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="border-border rounded-lg border p-8 backdrop-blur-[2px]">
            <Badge>Coming Soon</Badge>
            <h1 className="text-foreground font-cal mb-6 mt-2 text-3xl">
              Open-source monitoring service
            </h1>
            <p className="text-muted-foreground">
              OpenStatus is an open source alternative to your current
              monitoring service with beautiful status page.
            </p>
            {/* think of using the `A total of X events as Link as well */}
            <div className="my-4 flex items-center justify-center gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/play">Playground</Link>
              </Button>
              <Button asChild variant="link">
                <a
                  href="https://github.com/mxkaske/openstatus"
                  rel="noreferrer"
                  target="_blank"
                >
                  Star on GitHub
                </a>
              </Button>
            </div>
            <HeroForm />
          </div>
        </div>
        <div className="z-10 mx-auto w-full max-w-xl backdrop-blur-[2px]">
          <div className="border-border rounded-lg border p-8">
            <TableInputContainer events={data} />
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
