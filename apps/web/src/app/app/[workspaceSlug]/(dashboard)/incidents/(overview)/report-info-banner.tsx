import { Alert, AlertDescription, AlertTitle } from "@openstatus/ui";
import { Megaphone } from "lucide-react";
import Link from "next/link";

export function ReportInfoBanner() {
  return (
    <Alert className="max-w-4xl">
      <Megaphone className="h-4 w-4" />
      <AlertTitle>Looking for Status Reports?</AlertTitle>
      <AlertDescription>
        The incidents will be created automatically if an endpoint fails. If you
        want to inform your users about a planned maintenance, or a current
        issue you can create a status report. Go to{" "}
        <Link
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
          href="./status-pages"
        >
          Status Pages
        </Link>{" "}
        and select a page you want to report on.
      </AlertDescription>
    </Alert>
  );
}
