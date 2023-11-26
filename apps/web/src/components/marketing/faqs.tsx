import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@openstatus/ui";

// REMINDER: we can create a contentlayer document and the faq into it
const faqsConfig: Record<"q" | "a", string>[] = [
  {
    q: "What are the limits?",
    a: "You will start with a free plan by default which includes a total of <strong>5 monitors</strong> and <strong>1 status</strong> page as well as cron jobs of either <code>10m</code>, <code>30m</code> or <code>1h</code>.",
  },
  {
    q: "Who are we?",
    a: "We are <a href='https://twitter.com/thibaultleouay' target='_blank'>Thibault</a> and <a href='https://twitter.com/mxkaske' target='_blank'>Max</a>. We both have a 9-to-5 job and we are doing that project for the purpose of open source and the community. Of course, it would be nice to make that project self sustainable. It's not a sprint, it's a marathon.",
  },
  {
    q: "How does it work?",
    a: "We ping your endpoints from multiple regions to calculate uptime. We display the status on your status page.",
  },
  {
    q: "What regions do we support?",
    a: "We support one region for each continent to allow multi-regions monitoring.",
  },
  {
    q: "How can I help?",
    a: "You can star our project on <a href='https://github.com/openstatusHQ/openstatus'>GitHub</a>, or contribute to it. Or you can also become a <strong>Pro</strong> user.",
  },
];

export function FAQs() {
  return (
    <div className="grid gap-1">
      <h2 className="text-foreground font-cal text-center text-2xl">FAQ</h2>
      <Accordion type="single" collapsible className="w-full">
        {faqsConfig.map(({ q, a }, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger>{q}</AccordionTrigger>
            <AccordionContent>
              <div
                className="prose dark:prose-invert prose-sm"
                dangerouslySetInnerHTML={{ __html: a }}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
