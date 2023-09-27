import { HelpCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@openstatus/ui";

export function HelpCallout() {
  return (
    <Alert className="max-w-xl">
      <HelpCircle className="h-4 w-4" />
      <AlertTitle className="">Need help?</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        Let us know at{" "}
        <a
          href="mailto:ping@openstatus.dev"
          className="text-foreground font-medium underline hover:no-underline"
        >
          ping@openstatus.dev
        </a>{" "}
        or join our{" "}
        <a
          href="/discord"
          target="_blank"
          className="text-foreground font-medium underline hover:no-underline"
        >
          Discord
        </a>
        .
      </AlertDescription>
    </Alert>
  );
}
