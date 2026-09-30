import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@openstatus/ui/components/ui/avatar";
import { cn } from "@openstatus/ui/lib/utils";

export function UserAvatar({
  name,
  src,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Avatar>, "children"> & {
  name: string | null;
  src?: string | null;
}) {
  return (
    <Avatar className={cn("size-5 text-[10px]", className)} {...props}>
      {src ? <AvatarImage src={src} alt={name ?? ""} /> : null}
      <AvatarFallback className="bg-foreground text-background font-sans font-medium uppercase">
        {Array.from(name ?? "")[0] ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}
