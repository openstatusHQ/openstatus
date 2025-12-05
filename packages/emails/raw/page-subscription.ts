import { renderTemplate } from "./_components";

interface PageSubscriptionEmailProps {
  page: string;
  link: string;
  img?: {
    src: string;
    alt: string;
    href: string;
  };
}

export function renderPageSubscriptionEmail({
  page,
  link,
}: PageSubscriptionEmailProps) {
  return renderTemplate(
    `
    <p>Hello 👋</p>
    <p>You are receiving this email because you subscribed to receive updates from "${page}" Status Page.</p>
    <p>To confirm your subscription, please click the link below. The link is valid for 7 days. If you believe this is a mistake, please ignore this email.</p>
    <p>
      <a href="${link}">Confirm subscription</a>
    </p>
    `,
    `Confirm your subscription to "${page}" Status Page`,
  );
}
