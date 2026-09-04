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

/**
 * The mark as a loading indicator, told as a round-trip check. The cycle opens
 * on the complete S and holds, so a fast load only ever shows the static mark
 * and the swap from the plain icon is seamless. Then both slits wipe forward
 * and clear, the top slit shoots from the center out the right rim, a short
 * latency gap, the bottom slit comes in from the left rim to the center, and
 * the whole mark thumps once as the response lands, back into the hold. The
 * thump is delayed by one full cycle so the very first frame is still.
 * Each keyframe sets the easing of the segment it starts: travel settles into
 * its destination, the clear accelerates away. The thump overshoots the box,
 * so overflow is visible and the icon keeps the static mark's footprint.
 * Animates rect geometry directly; the static attributes are the resting mark,
 * so reduced motion and older engines fall back to the plain icon.
 */
export function OpenStatusLoadingIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      role="img"
      viewBox="0 0 330 330"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      overflow="visible"
      {...props}
    >
      <title>openstatus</title>
      <style>{`
        @keyframes openstatus-ping-out {
          0%, 29% { x: 122px; width: 208px; animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.3); }
          42% { x: 330px; width: 0; }
          48% { x: 122px; width: 0; animation-timing-function: cubic-bezier(0.25, 0, 0.1, 1); }
          70%, 100% { x: 122px; width: 208px; }
        }
        @keyframes openstatus-ping-in {
          0%, 29% { x: 0; width: 208px; animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.3); }
          42% { x: 208px; width: 0; }
          77% { x: 0; width: 0; animation-timing-function: cubic-bezier(0.25, 0, 0.1, 1); }
          100% { x: 0; width: 208px; }
        }
        @keyframes openstatus-ack {
          0% { transform: scale(1); }
          6% { transform: scale(1.06); }
          16%, 100% { transform: scale(1); }
        }
        .openstatus-slit { animation: 1.5s linear infinite; }
        .openstatus-slit-top { animation-name: openstatus-ping-out; }
        .openstatus-slit-bottom { animation-name: openstatus-ping-in; }
        .openstatus-mark {
          transform-origin: 165px 165px;
          animation: openstatus-ack 1.5s ease-in-out 1.5s infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .openstatus-slit, .openstatus-mark { animation: none; }
        }
      `}</style>
      <mask
        id="openstatus-mark-loading"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="330"
        height="330"
      >
        <circle cx="165" cy="165" r="165" fill="white" />
        <rect
          className="openstatus-slit openstatus-slit-top"
          x="122"
          y="96"
          width="208"
          height="15"
          fill="black"
        />
        <rect
          className="openstatus-slit openstatus-slit-bottom"
          x="0"
          y="219"
          width="208"
          height="15"
          fill="black"
        />
      </mask>
      <g className="openstatus-mark">
        <circle
          cx="165"
          cy="165"
          r="165"
          mask="url(#openstatus-mark-loading)"
        />
      </g>
    </svg>
  );
}
