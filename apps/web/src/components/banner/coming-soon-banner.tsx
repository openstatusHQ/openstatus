import { Alert, AlertDescription, AlertTitle } from "@openstatus/ui";
import { Hourglass } from "lucide-react";

interface Props {
  description?: string;
}

export function ComingSoonBanner({ description }: Props) {
  return (
    <Alert>
      <Hourglass className="h-4 w-4" />
      <AlertTitle>Coming Soon</AlertTitle>
      <AlertDescription>
        {description ??
          "This feature is coming soon. Keep an eye on our changelog."}
      </AlertDescription>
    </Alert>
  );
}
