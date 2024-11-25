"use client";

import { allFAQs } from "content-collections";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@openstatus/ui/src/components/accordion";

import { Mdx } from "../content/mdx";
import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "./card";

export function FAQs() {
  const faqs = allFAQs.sort((a, b) => a.order - b.order);
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon="message-circle" />
        <CardTitle>FAQs</CardTitle>
        <CardDescription>
          What you want to know about OpenStatus.
        </CardDescription>
      </CardHeader>
      <div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.slug} value={`item-${i}`}>
              <AccordionTrigger>{faq.title}</AccordionTrigger>
              <AccordionContent>
                <Mdx code={faq.mdx} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </CardContainer>
  );
}
