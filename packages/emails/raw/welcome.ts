import { renderTemplate } from "./_components";

export function renderWelcomeEmail() {
  return renderTemplate(
    `
    <p>Hello 👋</p>
    <p>Welcome to openstatus</p>
    <p>Openstatus is global uptime monitoring service with status page.</p>
    <p>Here are a few things you can do with openstatus:</p>
    <ul>
      <li>Use our <a href="https://docs.openstatus.dev/cli/getting-started/?ref=email-onboarding">CLI</a> to create, update and trigger your monitors.</li>
      <li>Learn how to monitor a <a href="https://docs.openstatus.dev/guides/how-to-monitor-mcp-server?ref=email-onboarding">MCP server</a>.</li>
      <li>Explore our uptime monitoring as code <a href="https://github.com/openstatusHQ/cli-template/?ref=email-onboarding">template directory</a>.</li>
      <li>Build your own status page with our <a href="https://api.openstatus.dev/v1">API</a> and host it where you want. Here's our <a href="https://github.com/openstatusHQ/astro-status-page">Astro template</a> that you can easily host on Cloudflare.</li>
    </ul>
    <p>Quick question: How did you learn about us? and why did you sign up?</p>
    <p>Thank you,</p>
    <p>Thibault Le Ouay Ducasse, co-founder of openstatus</p>
    `,
    "Welcome to openstatus",
  );
}
