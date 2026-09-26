export type Customer = {
  name: string;
  /** Public status page, or the customer story when there is one. */
  href: string;
  /** Under `public/`; a `.dark` sibling is picked up automatically. */
  logo?: string;
  story?: string;
  quote?: { text: string; name: string; role: string };
};

// Order is the order the logo cloud renders in.
export const customers: Customer[] = [
  {
    name: "Cal.com",
    href: "https://status.cal.com",
  },
  {
    name: "Twenty",
    href: "https://twenty-status.com",
    logo: "/assets/customers/twenty/logo.svg",
    story: "/customers/twenty",
    quote: {
      text: "Open-source CRM needs an open-source status page. Openstatus took us minutes to set up — and it covers everything our customers actually depend on.",
      name: "Félix Malfait",
      role: "Co-founder @twentycrm",
    },
  },
  {
    name: "Documenso",
    href: "https://status.documenso.com",
  },
  {
    name: "Traefik",
    href: "https://status.traefik.io",
    logo: "/assets/customers/traefik/logo.png",
    story: "/customers/traefik",
    quote: {
      text: "We picked openstatus because the workflow matched ours. We stayed because it keeps matching.",
      name: "Michel Loiseleur",
      role: "Head of Platforms @traefiklabs",
    },
  },
  {
    name: "Passbolt",
    href: "https://passboltuptime.com",
  },
  {
    name: "Hanko",
    href: "https://status.hanko.io",
  },
  {
    name: "WhiteBIT",
    href: "https://status.whitebit.com",
  },
  {
    name: "Superwall",
    href: "https://status.superwall.com",
  },
  {
    name: "OpenPanel",
    href: "https://status.openpanel.dev",
  },
  {
    name: "Probo",
    href: "https://probostatus.com",
  },
  {
    name: "StreamElements",
    href: "https://status.streamelements.com",
  },
  {
    name: "Smplrspace",
    href: "https://status.smplrspace.com",
  },
];

export function getCustomer(name: string) {
  const customer = customers.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (!customer) throw new Error(`Unknown customer "${name}"`);
  return customer;
}
