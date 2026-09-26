import { getCustomer } from "@/data/customers";

import { CustomLink } from "./custom-link";
import { Subtle } from "./subtle";

/** Pull quote for a customer from `data/customers.ts`; drop it into a `Grid` cell. */
export function Quote({ customer }: { customer: string }) {
  const { name, quote, story, href } = getCustomer(customer);
  if (!quote) throw new Error(`Customer "${name}" has no quote`);
  return (
    <figure className="not-prose flex h-full flex-col justify-between gap-4">
      <blockquote className="text-foreground text-balance">
        “{quote.text}”
      </blockquote>
      <figcaption className="flex flex-col gap-1 text-sm">
        <span>
          <span className="text-foreground font-medium">{quote.name}</span>{" "}
          <Subtle>{quote.role}</Subtle>
        </span>
        <CustomLink href={story ?? href}>
          {story ? "Read the story" : name}
        </CustomLink>
      </figcaption>
    </figure>
  );
}
