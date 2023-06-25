import { Badge } from "@/components/ui/badge";
import { HeroForm } from "./_components/hero-form";
import { Tinybird, getResponseList } from "@openstatus/tinybird";
import { env } from "@/env.mjs";
import { StatusContainer } from "./_components/status-container";
import MOCK from "@/app/_mocks/response-list.json";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export default async function Page() {
  // REMINDER: to be removed
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({});
    data = res.data;
  }
  return (
    <main className="min-h-screen w-full flex flex-col p-4 md:p-8 space-y-6">
      <div className="flex-1 flex flex-col justify-center items-center gap-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="rounded-lg border border-border backdrop-blur-[2px] p-8">
            <Badge>Coming Soon</Badge>
            <h1 className="text-3xl text-foreground font-cal mb-6 mt-2">
              Open-source monitoring service
            </h1>
            <p className="text-muted-foreground mb-4">
              OpenStatus is an open source alternative to your current
              monitoring service with beautiful status page.
            </p>
            <HeroForm />
          </div>
        </div>
        <div className="md:fixed bottom-8 right-8 max-w-max z-10">
          <StatusContainer events={data} />
        </div>
      </div>
      <footer className="text-center text-sm text-muted-foreground mx-auto rounded-full px-4 py-2 border border-border backdrop-blur-[2px]">
        A collaboration between{" "}
        <a
          href="https://twitter.com/mxkaske"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:no-underline text-foreground"
        >
          @mxkaske
        </a>{" "}
        and{" "}
        <a
          href="https://twitter.com/thibaultleouay"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:no-underline text-foreground"
        >
          @thibaultleouay
        </a>
      </footer>
    </main>
  );
}
