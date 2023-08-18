import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ProFeatureAlert() {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Custom domains are a Pro feature.</AlertTitle>
      <AlertDescription>
        If you want to use your own domain, please upgrade to the Pro plan. Go
        to{" "}
        <Link
          href="../settings"
          className="text-foreground inline-flex items-center font-medium underline underline-offset-4 hover:no-underline"
        >
          settings
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
