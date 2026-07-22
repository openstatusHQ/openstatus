const companies = [
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

export function TrustedBy() {
  return (
    <div className="not-prose -mx-4 px-4 pb-4 pt-6 text-center">
      <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Trusted by teams who ship transparency
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {companies.map((company) => (
          <a
            key={company.name}
            href={company.href}
            className="font-sans text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {company.name}
          </a>
        ))}
      </div>
    </div>
  );
}
