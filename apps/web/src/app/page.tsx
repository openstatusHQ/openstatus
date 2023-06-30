import { getResponseList, Tinybird } from "@openstatus/tinybird";

import MOCK from "@/app/_mocks/response-list.json";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { env } from "@/env.mjs";
import { HeroForm } from "./_components/hero-form";
import { TableInputContainer } from "./_components/table-input-container";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export default async function Page() {
  // REMINDER: to be removed
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({});
    data = res.data;
  }

  return (
    <main className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="border-border rounded-lg border p-8 backdrop-blur-[2px]">
            <Badge>Coming Soon</Badge>
            <h1 className="text-foreground font-cal mb-6 mt-2 text-3xl">
              Open-source monitoring service
            </h1>
            <p className="text-muted-foreground mb-4">
              OpenStatus is an open source alternative to your current
              monitoring service with beautiful status page.
            </p>
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
