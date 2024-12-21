import { OpenPanel, type PostEventPayload } from "@openpanel/sdk";
import type { EventProps } from "./events";

const op = new OpenPanel({
  clientId: `${process.env.OPENPANEL_CLIENT_ID}`,
  clientSecret: `${process.env.OPENPANEL_CLIENT_SECRET}`,
});

op.setGlobalProperties({
  env: process.env.VERCEL_ENV || "localhost",
  // app_version
});

type IdentifyProps = {
  userId?: string;
  fullName?: string | null;
  email?: string;
  workspaceId?: string;
  plan?: string;
};

export async function setupAnalytics(props: IdentifyProps) {
  if (props.userId) {
    const [firstName, lastName] = props.fullName?.split(" ") || [];
    await op.identify({
      profileId: props.userId,
      email: props.email,
      firstName: firstName,
      lastName: lastName,
      properties: {
        workspaceId: props.workspaceId,
        plan: props.plan,
      },
    });
  }

  return {
    track: (opts: EventProps & PostEventPayload["properties"]) => {
      const { name, ...rest } = opts;
      return op.track(name, rest);
    },
  };
}
