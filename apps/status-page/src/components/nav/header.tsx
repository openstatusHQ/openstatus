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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Menu, MessageCircleMore } from "lucide-react";
import NextLink from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";

function useNav() {
  const pathname = usePathname();
  const prefix = usePathnamePrefix();

  return [
    {
      label: "Status",
      href: `/${prefix}`,
      isActive: pathname === `/${prefix}`,
    },
    {
      label: "Events",
      href: `${prefix ? `/${prefix}` : ""}/events`,
      isActive: pathname.startsWith(`${prefix ? `/${prefix}` : ""}/events`),
    },
    {
      label: "Monitors",
      href: `${prefix ? `/${prefix}` : ""}/monitors`,
      isActive: pathname.startsWith(`${prefix ? `/${prefix}` : ""}/monitors`),
    },
  ];
}

export function Header(props: React.ComponentProps<"header">) {
  const trpc = useTRPC();
  const { domain } = useParams<{ domain: string }>();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  const sendPageSubscriptionMutation = useMutation(
    trpc.emailRouter.sendPageSubscription.mutationOptions({}),
  );

  const subscribeMutation = useMutation(
    trpc.statusPage.subscribe.mutationOptions({
      onSuccess: (id) => {
        if (!id) return;
        sendPageSubscriptionMutation.mutate({ id });
      },
    }),
  );

  const types = (
    page?.workspacePlan === "free"
      ? ["rss", "atom", "ssh"]
      : ["email", "rss", "atom", "ssh"]
  ) satisfies ("email" | "rss" | "atom" | "ssh")[];

  return (
    <header {...props}>
      <nav className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-3 py-2">
        {/* NOTE: same width as the `StatusUpdates` button */}
        <div className="w-[150px] shrink-0">
          <Link
            href={page?.homepageUrl || "/"}
            target={page?.homepageUrl ? "_blank" : undefined}
            rel={page?.homepageUrl ? "noreferrer" : undefined}
            className="rounded-full"
          >
            {page?.icon ? (
              <img
                src={page.icon}
                alt={`${page.title} status page`}
                className="size-8 rounded-full border"
              />
            ) : null}
          </Link>
        </div>
        <NavDesktop className="hidden md:flex" />
        <div className="flex min-w-[150px] items-center justify-end gap-2">
          {page?.contactUrl ? (
            <GetInTouch buttonType="icon" link={page.contactUrl} />
          ) : null}
          <StatusUpdates
            types={types}
            onSubscribe={async (email) => {
              await subscribeMutation.mutateAsync({ slug: domain, email });
            }}
            slug={page?.slug}
          />
          <NavMobile className="md:hidden" />
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
          className={cn("size-8 border", className)}
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

function GetInTouch({
  buttonType,
  className,
  link,
  ...props
}: React.ComponentProps<typeof Button> & {
  buttonType: "icon" | "text";
  link: string;
}) {
  if (buttonType === "text") {
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        className={className}
        asChild
        {...props}
      >
        <a href={link} target="_blank" rel="noreferrer">
          Get in touch
        </a>
      </Button>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className={cn("size-8", className)}
            asChild
            {...props}
          >
            <a href={link} target="_blank" rel="noreferrer">
              <MessageCircleMore />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Get in touch</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
