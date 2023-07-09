import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function AppHeader() {
  return (
    <header className="z-10 flex w-full items-center justify-between">
      <Link
        href="/"
        className="font-cal text-muted-foreground hover:text-foreground text-lg"
      >
        openstatus
      </Link>
      <UserButton />
    </header>
  );
}
