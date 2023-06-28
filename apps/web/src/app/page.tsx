import MOCK from "@/app/_mocks/response-list.json";
import { Badge } from "@/components/ui/badge";
import { env } from "@/env.mjs";

import { getResponseList, Tinybird } from "@openstatus/tinybird";

import { HeroForm } from "./_components/hero-form";
import { StatusContainer } from "./_components/status-container";

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
        <div className="bottom-8 right-8 z-10 max-w-max md:fixed">
          <StatusContainer events={data} />
        </div>
      </div>
      <footer className="text-muted-foreground border-border mx-auto rounded-full border px-4 py-2 text-center text-sm backdrop-blur-[2px]">
        A collaboration between{" "}
        <a
          href="https://twitter.com/mxkaske"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          @mxkaske
        </a>{" "}
        and{" "}
        <a
          href="https://twitter.com/thibaultleouay"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          @thibaultleouay
        </a>
      </footer>
    </main>
  );
}
