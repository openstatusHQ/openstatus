import { cn } from "@/lib/utils";
import { BrandName } from "./brand-name";
import { LoginButton } from "./login-button";

interface Props {
  className?: string;
}

export function PublicHeader({ className }: Props) {
  return (
    <header
      className={cn("flex w-full items-center justify-between", className)}
    >
      <BrandName />
      <LoginButton />
    </header>
  );
}
