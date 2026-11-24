import { Link, Link as TextLink } from "@/components/common/link";

export function Direct() {
  return (
    <Button asChild>
      <Link href="/a">a</Link> {/* expect: no-text-link-as-child */}
    </Button>
  );
}

export function Conditional({ external }: { external: boolean }) {
  return (
    <DropdownMenuItem asChild>
      {external ? (
        <TextLink href="https://b.example">b</TextLink> /* expect: no-text-link-as-child */
      ) : (
        <TextLink href="/b">b</TextLink> /* expect: no-text-link-as-child */
      )}
    </DropdownMenuItem>
  );
}
