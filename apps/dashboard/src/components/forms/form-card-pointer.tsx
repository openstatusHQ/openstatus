import { Button } from "@openstatus/ui/components/ui/button";
import Link from "next/link";

import {
  FormCard,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";

/** Stands where a card used to be and sends people to its new page. */
export function FormCardPointer({
  id,
  title,
  description,
  href,
  action,
}: {
  id: string;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <FormCard id={id}>
      <FormCardHeader>
        <FormCardTitle>{title}</FormCardTitle>
        <FormCardDescription>{description}</FormCardDescription>
      </FormCardHeader>
      <FormCardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link href={href}>{action}</Link>
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}
