import { getQueryClient, trpc } from "@/lib/trpc/server";
import { EmailClient } from "@openstatus/emails";
import { isTRPCClientError } from "@trpc/client";
import Resend from "next-auth/providers/resend";
import { getValidCustomDomain } from "../domain";

export const ResendProvider = Resend({
  apiKey: undefined,
  async sendVerificationRequest(params) {
    const url = params.url;
    const email = params.identifier;

    const emailClient = new EmailClient({
      apiKey: process.env.RESEND_API_KEY ?? "",
    });

    const { prefix } = getValidCustomDomain(params.request);

    if (!prefix) return;

    const queryClient = getQueryClient();
    const query = await (async () => {
      try {
        return await queryClient.fetchQuery(
          trpc.statusPage.validateEmailDomain.queryOptions({
            slug: prefix,
            email,
          }),
        );
      } catch (error) {
        if (!isTRPCClientError(error)) throw error;
        console.error(
          `[ResendProvider] validateEmailDomain rejected for slug="${prefix}" email="${email}": ${error.message}`,
        );
        return undefined;
      }
    })();

    if (!query) return;

    await emailClient.sendStatusPageMagicLink({
      page: query.page.title,
      link: url,
      to: params.identifier,
    });
  },
});
