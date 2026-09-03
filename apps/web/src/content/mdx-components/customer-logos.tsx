import { Grid } from "./grid";

const customers: { name: string; href: string }[] = [
  { name: "Cal.com", href: "https://status.cal.com" },
  { name: "Documenso", href: "https://status.documenso.com" },
  { name: "WhiteBIT", href: "https://status.whitebit.com" },
  { name: "Traefik", href: "/customers/traefik" },
  { name: "OpenPanel", href: "https://status.openpanel.dev" },
  { name: "Probo", href: "https://probostatus.com" },
  { name: "Hanko", href: "https://status.hanko.io" },
  { name: "Superwall", href: "https://status.superwall.com" },
  { name: "StreamElements", href: "https://status.streamelements.com/" },
  { name: "Smplrspace", href: "https://status.smplrspace.com" },
  { name: "Passbolt", href: "https://passboltuptime.com" },
  { name: "TwentyCRM", href: "/customers/twenty" },
];

export function CustomerLogos() {
  return (
    <Grid cols={4}>
      {customers.map((customer) => (
        <a key={customer.href} href={customer.href}>
          {customer.name}
        </a>
      ))}
    </Grid>
  );
}
