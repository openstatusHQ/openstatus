export function OpenStatusIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      role="img"
      viewBox="0 0 330 330"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...props}
    >
      <title>openstatus</title>
      {/* Bars are punched out rather than filled, so the mark sits on any
       * background. The id is static: duplicate instances resolve to the first
       * definition, which is identical. */}
      <mask
        id="openstatus-mark"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="330"
        height="330"
      >
        <circle cx="165" cy="165" r="165" fill="white" />
        <path d="M330 96H122V111H330V96Z" fill="black" />
        <path d="M208 219H0V234H208V219Z" fill="black" />
      </mask>
      <circle cx="165" cy="165" r="165" mask="url(#openstatus-mark)" />
    </svg>
  );
}
