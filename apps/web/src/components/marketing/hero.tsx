import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Badge, Button } from "@openstatus/ui";

import { getGitHubStars } from "@/lib/github";
import { cn, numberFormatter } from "@/lib/utils";

export function Hero() {
  return (
    <div className="my-10 flex w-full flex-col justify-center gap-1 px-3 py-4 text-center md:my-20 md:p-6">
      <div>
        <Badge variant="outline" className="backdrop-blur-[2px]">
          <Link
            href="https://github.com/openstatusHQ/openstatus/stargazers"
            target="_blank"
            rel="noreferrer"
            className="flex items-center"
          >
            Proudly Open Source
            <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Badge>
      </div>
      <div className="flex flex-col gap-6">
        <h1
          className={cn(
            "text-foreground font-cal text-4xl md:text-6xl",
            "bg-gradient-to-tl from-[hsl(var(--muted))] from-0% to-[hsl(var(--foreground))] to-40% bg-clip-text text-transparent",
          )}
        >
          A better way to monitor your services.
        </h1>
        <p className="text-muted-foreground mx-auto max-w-md text-lg md:max-w-xl md:text-xl">
          Monitor your API and website from 6 continents, detect some
          performance issues and receive notifications before your users are
          affected.
        </p>
      </div>
      <div className="my-4 grid gap-2 sm:grid-cols-2">
        <div className="text-center sm:block sm:text-right">
          <Button className="w-48 rounded-full sm:w-auto" asChild>
            <Link href="/app/sign-up">Get Started</Link>
          </Button>
        </div>
        <div className="text-center sm:block sm:text-left">
          <Button
            variant="outline"
            className="w-48 rounded-full sm:w-auto"
            asChild
          >
            <Link href="/github" target="_blank">
              Star on GitHub{" "}
              <Suspense fallback={<StarsBadgeFallback />}>
                <StarsBadge />
              </Suspense>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StarsBadgeFallback() {
  return (
    <Badge variant="secondary" className="ml-1">
      ~
    </Badge>
  );
}

async function StarsBadge() {
  const stars = await getGitHubStars();
  return (
    <>
      <Badge variant="secondary" className="ml-1 hidden sm:block">
        {numberFormatter(stars)}
      </Badge>
      <Badge variant="secondary" className="ml-1 block sm:hidden">
        {stars}
      </Badge>
    </>
  );
}
