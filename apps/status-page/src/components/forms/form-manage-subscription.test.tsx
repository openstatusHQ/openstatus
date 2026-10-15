import type { RouterOutputs } from "@openstatus/api";
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import { FormManageSubscription } from "./form-manage-subscription";

type Page = NonNullable<RouterOutputs["statusPage"]["get"]>;

// safe because the form only reads `page.trackers`
function asPage(trackers: unknown[]): Page {
  return { trackers } as unknown as Page;
}

const page = asPage([
  {
    type: "group",
    groupId: 1,
    groupName: "API",
    components: [
      { id: 2, name: "REST" },
      { id: 3, name: "GraphQL" },
    ],
  },
  { type: "component", component: { id: 4, name: "Website" } },
]);

const onSubmit = async () => {};

function checkboxes(html: string) {
  return [
    ...html.matchAll(
      /role="checkbox" aria-checked="([^"]+)"[\s\S]*?<label[^>]*>([^<]+)<\/label>/g,
    ),
  ].map((m) => [m[2], m[1]]);
}

describe("FormManageSubscription", () => {
  it("checks the selected components and marks a partial group as mixed", () => {
    const html = renderToStaticMarkup(
      <FormManageSubscription
        page={page}
        onSubmit={onSubmit}
        defaultValues={{ pageComponents: [2, 4], subscribeComponents: true }}
      />,
    );
    expect(checkboxes(html)).toEqual([
      ["Subscribe to specific components", "true"],
      ["API", "mixed"],
      ["REST", "true"],
      ["GraphQL", "false"],
      ["Website", "true"],
    ]);
  });

  it("marks a group checked once all its components are selected", () => {
    const html = renderToStaticMarkup(
      <FormManageSubscription
        page={page}
        onSubmit={onSubmit}
        defaultValues={{ pageComponents: [2, 3], subscribeComponents: true }}
      />,
    );
    expect(checkboxes(html)).toContainEqual(["API", "true"]);
  });

  it("subscribes to specific components by default", () => {
    const html = renderToStaticMarkup(
      <FormManageSubscription page={page} onSubmit={onSubmit} />,
    );
    expect(checkboxes(html)[0]).toEqual([
      "Subscribe to specific components",
      "true",
    ]);
    expect(html).toContain("REST");
  });

  it("hides the component list when subscribed to the whole page", () => {
    const html = renderToStaticMarkup(
      <FormManageSubscription
        page={page}
        onSubmit={onSubmit}
        defaultValues={{ pageComponents: [], subscribeComponents: false }}
      />,
    );
    expect(html).not.toContain("REST");
    expect(html).not.toContain("Website");
  });

  it("shows an empty state for a page without components", () => {
    const html = renderToStaticMarkup(
      <FormManageSubscription page={asPage([])} onSubmit={onSubmit} />,
    );
    expect(html).toContain("No components to subscribe to");
    expect(html).toContain(
      "This status page has no components to subscribe to.",
    );
  });
});
