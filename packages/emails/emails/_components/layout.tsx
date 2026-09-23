/** @jsxRuntime automatic @jsxImportSource react */

import type * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
} from "react-email";

import { Footer } from "./footer";
import { Pill } from "./pill";
import { colors, styles, type Tone } from "./styles";

export interface Brand {
  name: string;
  href: string;
  /** Hosted PNG; inline SVG data URIs are stripped by Gmail. */
  logo?: string;
}

const openstatus = {
  name: "openstatus",
  href: "https://www.openstatus.dev",
  logo: "https://www.openstatus.dev/assets/logos/OpenStatus.png",
} satisfies Brand;

// Tokenized links (verify, magic link) are one-time: a mail scanner following
// the header link would consume them, so the brand points at the page origin.
function origin(href: string) {
  try {
    return new URL(href).origin;
  } catch {
    return href;
  }
}

export function statusPageBrand(page: string, href: string, logo?: string) {
  return {
    name: /\bstatus$/i.test(page) ? page : `${page} Status`,
    href: origin(href),
    logo,
  } satisfies Brand;
}

interface LayoutProps {
  preview: string;
  pill?: { tone: Tone; label: string };
  brand?: Brand;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export function Layout({
  preview,
  pill,
  brand = openstatus,
  footer = <Footer />,
  children,
}: LayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Section style={styles.header}>
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
              >
                <tbody>
                  <tr>
                    {brand.logo ? (
                      <td width={40} valign="middle">
                        <Img
                          src={brand.logo}
                          width="28"
                          height="28"
                          alt=""
                          style={{ display: "block", borderRadius: "999px" }}
                        />
                      </td>
                    ) : null}
                    <td valign="middle">
                      <Link
                        href={brand.href}
                        style={{
                          color: colors.foreground,
                          fontSize: "15px",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        {brand.name}
                      </Link>
                    </td>
                    {pill ? (
                      <td align="right" valign="middle">
                        <Pill tone={pill.tone}>{pill.label}</Pill>
                      </td>
                    ) : null}
                  </tr>
                </tbody>
              </table>
            </Section>
            <Section style={styles.content}>{children}</Section>
          </Section>
          {footer}
        </Container>
      </Body>
    </Html>
  );
}
