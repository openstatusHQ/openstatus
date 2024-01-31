import Link from "next/link";

import { Button } from "@openstatus/ui";

export function BottomCTA() {
  return (
    <div className="my-8 flex flex-col items-center justify-between gap-6">
      <p className="text-muted-foreground max-w-lg text-center text-lg">
        Learn over time how your services are performing, and inform your users
        when there are issues.
      </p>
      <div className="flex gap-2">
        <Button className="rounded-full" asChild>
          <Link href="/app/sign-up">Start for Free</Link>
        </Button>
        <Button className="rounded-full" variant="outline" asChild>
          <Link href="/cal" target="_blank">
            Schedule a Demo
          </Link>
        </Button>
      </div>
    </div>
  );
}
