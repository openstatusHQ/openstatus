/** @jsxRuntime automatic @jsxImportSource react */

import type * as React from "react";
import { Section, Text } from "react-email";

import { colors, tones } from "./styles";

export function Callout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const success = tone === "success";
  const text = success ? tones.success.text : colors.body;
  return (
    <Section
      style={{
        margin: "8px 0 24px",
        padding: "18px 20px",
        borderRadius: "10px",
        border: `1px solid ${success ? tones.success.border : colors.subtle}`,
        backgroundColor: success ? tones.success.bg : colors.subtle,
      }}
    >
      <Text
        style={{
          margin: "0 0 4px",
          fontSize: "15px",
          lineHeight: "22px",
          fontWeight: 600,
          color: success ? tones.success.text : colors.foreground,
        }}
      >
        {title}
      </Text>
      <Text
        style={{ margin: 0, fontSize: "15px", lineHeight: "24px", color: text }}
      >
        {children}
      </Text>
    </Section>
  );
}
