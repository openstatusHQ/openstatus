/** @jsxRuntime automatic @jsxImportSource react */

import { Text } from "react-email";

import { colors, fonts } from "./styles";

export function CodeBlock({ children }: { children: string }) {
  return (
    <Text
      style={{
        margin: "0 0 24px",
        padding: "14px 16px",
        borderLeft: `3px solid ${colors.border}`,
        borderRadius: "0 8px 8px 0",
        backgroundColor: colors.subtle,
        fontFamily: fonts.mono,
        fontSize: "13px",
        lineHeight: "20px",
        color: colors.body,
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </Text>
  );
}
