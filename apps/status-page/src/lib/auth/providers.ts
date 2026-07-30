import { EmailClient } from "@openstatus/emails";
import Resend from "next-auth/providers/resend";

import { getPageSlugHeader } from "../page-slug";
import { getQueryClient, trpc } from "../trpc/server";

export const ResendProvider = Resend({
  apiKey: undefined,
  async sendVerificationRequest(params) {
    const url = params.url;
    const email = params.identifier;

    const emailClient = new EmailClient({
      apiKey: process.env.RESEND_API_KEY ?? "",
    });

    // next-auth forwards the originating request's headers, so the proxy's
    // header survives into the internal signin request.
    const slug = getPageSlugHeader(params.request.headers);

    if (!slug) return;

    const queryClient = getQueryClient();
    const query = await queryClient.fetchQuery(
      trpc.statusPage.validateEmailDomain.queryOptions({ slug, email }),
    );

    if (!query) return;

    await emailClient.sendStatusPageMagicLink({
      page: query.page.title,
      link: url,
      to: params.identifier,
    });
  },
});
