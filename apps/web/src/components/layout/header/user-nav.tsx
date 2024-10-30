import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ThemeIcon } from "@/components/theme/theme-icon";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Skeleton,
} from "@openstatus/ui";

export function UserNav() {
  const session = useSession();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { setTheme, theme } = useTheme();

  if (session.status !== "authenticated") {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={session.data.user?.photoUrl || undefined}
              alt={
                session.data.user?.name ||
                `${session.data.user?.firstName} ${session.data.user?.lastName}`
              }
            />
            <AvatarFallback className="bg-gradient-to-br from-foreground via-muted-foreground to-muted opacity-70" />
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="truncate font-medium text-sm leading-none">
              {session.data.user?.name ||
                `${session.data.user?.firstName} ${session.data.user?.lastName}`}
            </p>
            <p className="truncate text-muted-foreground text-xs leading-none">
              {session.data.user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/app/${workspaceSlug}/settings/billing`}>Billing</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/app/${workspaceSlug}/settings/user`}>Profile</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>{" "}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            {/* REMINDER: consider using that the data-state styles as default */}
            <DropdownMenuSubTrigger className="gap-1 [&_svg]:text-muted-foreground [&_svg]:data-[highlighted]:text-foreground [&_svg]:data-[state=open]:text-foreground">
              <div className="flex w-full flex-row items-center justify-between">
                <span>Switch theme</span>
                <ThemeIcon theme={theme} />
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                {["light", "dark", "system"].map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={theme === option}
                    onClick={() => setTheme(option)}
                    className="justify-between capitalize [&_svg]:text-muted-foreground [&_svg]:data-[highlighted]:text-foreground [&_svg]:data-[state=open]:text-foreground"
                  >
                    {option}
                    <ThemeIcon theme={option} />
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
