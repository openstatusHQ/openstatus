/** @jsxRuntime automatic @jsxImportSource react */

import type * as React from "react";

import { colors, fonts, type Tone, tones } from "./styles";

export interface KeyValueRow {
  label: string;
  value: React.ReactNode;
  /** Muted text after the value, e.g. "threshold 250 ms". */
  hint?: string;
  mono?: boolean;
  bold?: boolean;
  tone?: Tone;
  dot?: boolean;
}

const cell = {
  padding: "14px 18px",
  fontSize: "15px",
  lineHeight: "22px",
} satisfies React.CSSProperties;

export function KeyValue({ rows }: { rows: KeyValueRow[] }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        margin: "8px 0 24px",
        border: `1px solid ${colors.border}`,
        borderRadius: "10px",
        borderCollapse: "separate",
        borderSpacing: 0,
        overflow: "hidden",
      }}
    >
      <tbody>
        {rows.map((row, i) => {
          const tone = row.tone ? tones[row.tone] : undefined;
          const borderTop = i === 0 ? undefined : `1px solid ${colors.border}`;
          const hasValue = row.value !== null && row.value !== undefined;
          return (
            <tr
              key={row.label}
              style={{
                backgroundColor: i % 2 === 0 ? colors.subtle : colors.card,
              }}
            >
              <td
                colSpan={hasValue ? undefined : 2}
                style={{ ...cell, borderTop, color: colors.muted }}
              >
                {row.label}
              </td>
              {hasValue ? (
                <td
                  align="right"
                  style={{
                    ...cell,
                    borderTop,
                    textAlign: "right",
                    wordBreak: "break-word",
                    color: tone?.text ?? colors.foreground,
                    fontWeight: row.bold || (tone && row.hint) ? 600 : 400,
                    fontFamily: row.mono ? fonts.mono : undefined,
                  }}
                >
                  {row.dot ? (
                    <span
                      style={{
                        color: (tone ?? tones.neutral).dot,
                        fontFamily: fonts.sans,
                      }}
                    >
                      ●&nbsp;&nbsp;
                    </span>
                  ) : null}
                  {row.value}
                  {row.hint ? (
                    <span
                      style={{
                        color: colors.muted,
                        fontWeight: 400,
                        fontFamily: fonts.sans,
                      }}
                    >
                      {" · "}
                      {row.hint}
                    </span>
                  ) : null}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
