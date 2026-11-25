/** @jsxRuntime automatic @jsxImportSource react */

import type * as React from "react";
import { Heading as EmailHeading, Text } from "react-email";

import { colors, styles } from "./styles";

export function Mono({ children }: { children: React.ReactNode }) {
  return <span style={styles.mono}>{children}</span>;
}

export function Heading({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <EmailHeading
        as="h1"
        style={{
          margin: children ? "0 0 12px" : "0 0 20px",
          fontSize: "24px",
          lineHeight: "30px",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: colors.foreground,
        }}
      >
        {title}
      </EmailHeading>
      {children ? (
        <Text style={{ ...styles.text, fontSize: "16px", lineHeight: "26px" }}>
          {children}
        </Text>
      ) : null}
    </>
  );
}
