import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { renderToStaticMarkup } from "react-dom/server";

import {
  FormCard,
  FormCardContent,
  FormCardHeader,
  FormCardTitle,
} from "./form-card";
import { FormEmail } from "./form-email";
import { FormPassword } from "./form-password";
import { FormSubscribeEmail } from "./form-subscribe-email";

const onSubmit = async () => {};

describe("FormEmail", () => {
  it("renders an empty, labelled email input", () => {
    const html = renderToStaticMarkup(<FormEmail id="f" onSubmit={onSubmit} />);
    expect(html).toContain('id="f"');
    expect(html).toMatch(/<label[^>]*>Email<\/label>/);
    expect(html).toMatch(/<input type="email"[^>]*value=""/);
  });
});

describe("FormPassword", () => {
  it("renders a masked, labelled password input", () => {
    const html = renderToStaticMarkup(<FormPassword onSubmit={onSubmit} />);
    expect(html).toMatch(/<label[^>]*>Password<\/label>/);
    expect(html).toContain('type="password"');
  });
});

describe("FormSubscribeEmail", () => {
  it("starts subscribed to the whole page", () => {
    const html = renderToStaticMarkup(
      <FormSubscribeEmail onSubmit={onSubmit} />,
    );
    expect(html).toContain('placeholder="subscribe@me.com"');
    expect(html).toMatch(
      /role="checkbox" aria-checked="false"[\s\S]*Subscribe to specific components/,
    );
    expect(html).not.toContain("No components to subscribe to");
  });
});

describe("FormCard", () => {
  it("applies the variant border", () => {
    expect(
      renderToStaticMarkup(<FormCard variant="destructive">x</FormCard>),
    ).toContain("border-destructive");
    expect(
      renderToStaticMarkup(<FormCard variant="info">x</FormCard>),
    ).toContain("border-info");
  });

  it("composes header, title and content", () => {
    const html = renderToStaticMarkup(
      <FormCard>
        <FormCardHeader>
          <FormCardTitle>Subscribe</FormCardTitle>
        </FormCardHeader>
        <FormCardContent>Body</FormCardContent>
      </FormCard>,
    );
    expect(html).toMatch(/Subscribe[\s\S]*Body/);
  });
});
