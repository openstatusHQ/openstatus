import { cn } from "@/lib/utils";
import { Fly, Koyeb, Railway } from "@openstatus/icons";
import { Globe } from "lucide-react";

export function IconCloudProvider({
  provider,
  className,
}: React.ComponentProps<"svg"> & {
  provider: string;
}) {
  switch (provider) {
    case "fly":
      return <Fly className={cn("size-4", className)} />;
    case "koyeb":
      return <Koyeb className={cn("size-4", className)} />;
    case "railway":
      return <Railway className={cn("size-4", className)} />;
    default:
      return <Globe className={cn("size-4", className)} />;
  }
}
