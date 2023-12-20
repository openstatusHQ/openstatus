"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { Button } from "@openstatus/ui";

type Props = {
  navigation: { label: string; href: string; segment: string | null }[];
};

export function Navbar({ navigation }: Props) {
  const selectedSegment = useSelectedLayoutSegment();

  return (
    <ul className="flex items-center gap-2">
      {navigation.map(({ label, href, segment }) => {
        const isActive = segment === selectedSegment;
        return (
          <li key={segment}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <Link href={href}>{label}</Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
