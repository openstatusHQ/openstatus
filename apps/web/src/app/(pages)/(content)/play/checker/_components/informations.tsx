import { Shell } from "@/components/dashboard/shell";
import { Separator } from "@openstatus/ui";
import { regionDict } from "@openstatus/utils";

const TOTAL_REGIONS = Object.keys(regionDict).length;
const TOTAL_PROVIDERS = Object.keys(regionDict).reduce((acc, region) => {
  return acc.add(regionDict[region as keyof typeof regionDict].provider);
}, new Set<"fly" | "koyeb" | "railway">());

export function Informations() {
  return (
    <Shell>
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h3 className="font-semibold">What Is a Website Speed Checker?</h3>
          <p className="text-muted-foreground">
            A Website Speed Checker is an online tool that measures how fast
            your website or API responds when someone visits it. It analyzes
            various website performance metrics to help you understand which
            elements slow down your page load time.
          </p>
          <p className="text-muted-foreground">
            Speed checkers can focus on two aspects of performance:
          </p>
          <ul className="ml-4 list-outside list-disc space-y-1 text-muted-foreground">
            <li>
              <strong className="font-semibold text-foreground">
                Client-side performance
              </strong>
              , which includes metrics like First Contentful Paint (FCP),
              Largest Contentful Paint (LCP), and Cumulative Layout Shift (CLS)
              — all indicators of how quickly your site becomes visible and
              usable to visitors.
            </li>
            <li>
              <strong className="font-semibold text-foreground">
                Server-side performance (or network performance)
              </strong>
              , which looks at the technical steps of a request such as DNS
              lookup, TCP connection, TLS handshake, and server response time.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Understanding both sides helps you identify whether slowdowns are
            caused by your frontend assets or your backend infrastructure.
          </p>
        </div>
        <div className="grid gap-1">
          <h3 className="font-semibold">What Is a Global Speed Checker?</h3>
          <p className="text-muted-foreground">
            A Global Speed Checker measures your website or API's latency and
            response time from multiple locations around the world. Instead of
            testing from just one data center, it runs checks from{" "}
            {TOTAL_REGIONS} global regions across {TOTAL_PROVIDERS.size} cloud
            providers, giving you a complete picture of your site's real-world
            performance.
          </p>
        </div>
        <Separator />
        <div className="grid gap-1">
          <p className="text-muted-foreground">With OpenStatus, you can:</p>
          <ul className="ml-4 list-outside list-disc space-y-1 text-muted-foreground">
            <li>Test how fast your API or website responds worldwide.</li>
            <li>Compare latency across different regions.</li>
            <li>Identify network bottlenecks.</li>
            <li>Monitor uptime and availability in real time.</li>
          </ul>
          <p className="text-muted-foreground">
            Whether you want to test your website speed from Europe, Asia, North
            America, or beyond, our Global Speed Checker gives accurate,
            consistent data from distributed locations.
          </p>
          <p className="text-muted-foreground">
            If you'd like to request additional test regions or providers, feel
            free to contact us at{" "}
            <a href="mailto:ping@openstatus.dev" className="text-foreground">
              ping@openstatus.dev
            </a>
            .
          </p>
        </div>
      </div>
    </Shell>
  );
}
