import NextLink from "next/link";

import { Link } from "@/components/common/link";

export function Host() {
  return (
    <Button asChild>
      <NextLink href="/a">a</NextLink>
    </Button>
  );
}

export function NotSlotted() {
  return (
    <Button asChild={false}>
      <Link href="/b">b</Link>
    </Button>
  );
}

export function Inline() {
  return (
    <p>
      Read the <Link href="/docs">docs</Link>.
    </p>
  );
}
