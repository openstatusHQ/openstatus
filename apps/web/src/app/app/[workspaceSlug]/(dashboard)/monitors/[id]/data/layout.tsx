import * as React from "react";

// replacing intercepting route for expanded table rows

export default function DataTableLayout({
  children, // modal,
}: {
  children: React.ReactNode;
  // modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* {modal} */}
    </>
  );
}
