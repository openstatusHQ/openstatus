/** @jsxRuntime automatic @jsxImportSource react */

import { Button, Link } from "react-email";

import { colors } from "./styles";

interface Action {
  label: string;
  href: string;
}

export function Actions({
  primary,
  secondary,
}: {
  primary: Action;
  secondary?: Action;
}) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ margin: "4px 0 0" }}
    >
      <tbody>
        <tr>
          <td>
            <Button
              href={primary.href}
              style={{
                padding: "13px 20px",
                borderRadius: "8px",
                backgroundColor: colors.foreground,
                color: "#ffffff",
                fontSize: "15px",
                lineHeight: "20px",
                fontWeight: 600,
              }}
            >
              {primary.label}
            </Button>
          </td>
          {secondary ? (
            <td style={{ paddingLeft: "18px" }}>
              <Link
                href={secondary.href}
                style={{
                  color: colors.body,
                  fontSize: "15px",
                  textDecoration: "underline",
                }}
              >
                {secondary.label}
              </Link>
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}
