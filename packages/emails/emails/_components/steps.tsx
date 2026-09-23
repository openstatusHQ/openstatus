/** @jsxRuntime automatic @jsxImportSource react */

import type * as React from "react";
import { Text } from "react-email";

import { colors, styles } from "./styles";

export function Steps({
  label,
  variant = "ordered",
  items,
}: {
  label: string;
  variant?: "ordered" | "dashed";
  items: React.ReactNode[];
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{ margin: "0 0 24px" }}
      >
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td
                width={28}
                valign="top"
                style={{
                  padding: "0 0 10px",
                  fontSize: "15px",
                  lineHeight: "24px",
                  color: colors.faint,
                }}
              >
                {variant === "ordered" ? `${i + 1}.` : "—"}
              </td>
              <td
                style={{
                  padding: "0 0 10px",
                  fontSize: "15px",
                  lineHeight: "24px",
                  color: colors.body,
                }}
              >
                {item}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
