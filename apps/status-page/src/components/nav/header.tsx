"use client";

import { Link } from "@/components/common/link";
import { StatusUpdates } from "@/components/status-page/status-updates";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import NextLink from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function useNav() {
  const pathname = usePathname();
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostnames = window.location.hostname.split(".");
      const pathnames = window.location.pathname.split("/");
      if (
        hostnames.length > 2 &&
        hostnames[0] !== "www" &&
        !window.location.hostname.endsWith(".vercel.app")
      ) {
        setPrefix(hostnames[0]);
      } else {
        setPrefix(pathnames[1]);
      }
    }
  }, []);

  return [
    {
      label: "Status",
      href: `/${prefix}`,
      isActive: pathname === `/${prefix}`,
    },
    {
      label: "Events",
      href: `/${prefix}/events`,
      isActive: pathname.startsWith(`/${prefix}/events`),
    },
    {
      label: "Monitors",
      href: `/${prefix}/monitors`,
      isActive: pathname.startsWith(`/${prefix}/monitors`),
    },
  ];
}

export function Header(props: React.ComponentProps<"header">) {
  const trpc = useTRPC();
  const { domain } = useParams<{ domain: string }>();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  const subscribeMutation = useMutation(
    trpc.statusPage.subscribe.mutationOptions({
      onSuccess: (id) => {
        // TODO: send email mutation
        console.log(id);
      },
    }),
  );

  const types = (
    page?.workspacePlan === "free" ? ["rss", "atom"] : ["email", "rss", "atom"]
  ) satisfies ("email" | "rss" | "atom")[];

  return (
    <header {...props}>
      <nav className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-3 py-2">
        {/* NOTE: same width as the `StatusUpdates` button */}
        <div className="w-[105px] shrink-0">
          <Link href="/">
            <img
              src="https://www.openstatus.dev/icon.png"
              alt="Craft"
              className="size-8 rounded-full border"
            />
          </Link>
        </div>
        <NavDesktop className="hidden md:flex" />
        <StatusUpdates
          className="hidden md:block"
          types={types}
          onSubscribe={async (email) => {
            await subscribeMutation.mutateAsync({ slug: domain, email });
          }}
        />
        <div className="flex gap-3 md:hidden">
          <NavMobile />
          <StatusUpdates
            types={types}
            onSubscribe={async (email) => {
              await subscribeMutation.mutateAsync({ slug: domain, email });
            }}
          />
        </div>
      </nav>
    </header>
  );
}

function NavDesktop({ className, ...props }: React.ComponentProps<"ul">) {
  const nav = useNav();
  return (
    <ul className={cn("flex flex-row gap-2", className)} {...props}>
      {nav.map((item) => {
        return (
          <li key={item.label}>
            <Button
              variant={item.isActive ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <NextLink href={item.href}>{item.label}</NextLink>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function NavMobile({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const nav = useNav();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn("size-8", className)}
          {...props}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader className="border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-4">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => {
              return (
                <li key={item.label} className="w-full">
                  <Button
                    variant={item.isActive ? "secondary" : "ghost"}
                    onClick={() => setOpen(false)}
                    className="w-full justify-start"
                    size="sm"
                    asChild
                  >
                    <NextLink href={item.href}>{item.label}</NextLink>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
