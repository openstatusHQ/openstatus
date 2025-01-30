export const colors = {
  success: "#51b363",
  danger: "#ec6041",
  warning: "#ffd60a",
  info: "#3d9eff",
};

export const styles = {
  main: {
    backgroundColor: "#ffffff",
    color: "#24292e",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "20px 0 48px",
  },
  section: {
    padding: "24px",
    margin: "24px 0",
    border: "solid 1px #dedede",
    borderRadius: "5px",
  },
  button: {
    backgroundColor: "#24292e",
    color: "#ffffff",
    padding: "8px 16px",
    borderRadius: "6px",
  },
  link: {
    textDecoration: "underline",
    color: colors.info,
  },
  bold: {
    fontWeight: "bold",
  },
  row: {
    borderTop: "1px solid #dedede",
  },
} satisfies Record<string, React.CSSProperties>;
