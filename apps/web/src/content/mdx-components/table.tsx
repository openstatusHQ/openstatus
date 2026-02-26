import type React from "react";

export function Table(props: React.ComponentProps<"table">) {
  return (
    <div className="table-wrapper">
      <table {...props} />
    </div>
  );
}
