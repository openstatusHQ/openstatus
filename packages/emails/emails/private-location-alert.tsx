/** @jsxRuntime automatic @jsxImportSource react */

import { z } from "zod";

import { Actions } from "./_components/actions";
import { Footer } from "./_components/footer";
import { formatDateTime, plural } from "./_components/format";
import { Heading, Mono } from "./_components/heading";
import { KeyValue, type KeyValueRow } from "./_components/key-value";
import { Layout } from "./_components/layout";
import { Steps } from "./_components/steps";

const PrivateLocationAlertSchema = z.object({
  locationName: z.string(),
  status: z.enum(["error", "recovered"]),
  lastSeenAt: z.string(),
  /** Monitors scheduled on this location. */
  monitorCount: z.number().optional(),
});

export type PrivateLocationAlertProps = z.infer<
  typeof PrivateLocationAlertSchema
>;

const LOCATIONS_URL = "https://app.openstatus.dev/settings/private-locations";

export function privateLocationAlertSubject(
  props: Pick<PrivateLocationAlertProps, "locationName" | "status">,
): string {
  return props.status === "error"
    ? `Checks paused — "${props.locationName}" stopped reporting`
    : `Checks resumed — "${props.locationName}" is reporting again`;
}

const PrivateLocationAlertEmail = (props: PrivateLocationAlertProps) => {
  const isError = props.status === "error";
  const rows: KeyValueRow[] = [
    { label: "Location", value: props.locationName, mono: true },
    { label: "Last result", value: formatDateTime(props.lastSeenAt) },
  ];
  if (props.monitorCount) {
    rows.push({
      label: isError ? "Checks skipped" : "Checks resumed",
      value: plural(props.monitorCount, "monitor"),
    });
  }

  return (
    <Layout
      preview={
        isError
          ? `Last result ${formatDateTime(props.lastSeenAt)}. Three things to check.`
          : "Checks on this private location are running again."
      }
      pill={
        isError
          ? { tone: "danger", label: "Unhealthy" }
          : { tone: "success", label: "Recovered" }
      }
      footer={
        <Footer reason="You get this because you are a member of this workspace." />
      }
    >
      <Heading
        title={
          <>
            Checks on <Mono>{props.locationName}</Mono>{" "}
            {isError ? "are paused" : "are running again"}
          </>
        }
      >
        {isError
          ? "This private location hasn’t sent a result for over 15 minutes. Until it reconnects, every check scheduled on it is skipped — no data, no alerts."
          : "This private location is reporting again and every check scheduled on it has resumed. No action needed."}
      </Heading>
      <KeyValue rows={rows} />
      {isError ? (
        <Steps
          label="Check, in this order"
          items={[
            "The private location container is still running.",
            <>
              It can reach openstatus outbound over HTTPS (port <Mono>443</Mono>
              ).
            </>,
            "Its token hasn’t been rotated or revoked.",
          ]}
        />
      ) : null}
      <Actions
        primary={{ label: "View private location", href: LOCATIONS_URL }}
      />
    </Layout>
  );
};

PrivateLocationAlertEmail.PreviewProps = {
  locationName: "eu-west-private",
  status: "error",
  lastSeenAt: "2026-07-23T10:00:00Z",
  monitorCount: 4,
} satisfies PrivateLocationAlertProps;

export default PrivateLocationAlertEmail;
