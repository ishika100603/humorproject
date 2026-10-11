// Original illustrations for small moments: the judge cat, the referee cat,
// and the "log in / log out" log and box.

const INK = "#141414";
const S = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function CatHead() {
  return (
    <g>
      <path d="M40 70 L46 22 L78 52 Z" fill="#ffffff" {...S} />
      <path d="M160 70 L154 22 L122 52 Z" fill="#ffffff" {...S} />
      <path d="M50 64 L52 38 L70 54 Z M150 64 L148 38 L130 54 Z" fill="#ffffff" />
      <ellipse cx="100" cy="100" rx="70" ry="60" fill="#ffffff" {...S} />
      <path d="M86 44 Q100 64 114 44 Q108 72 100 74 Q92 72 86 44 Z" fill="#ffffff" />
      <ellipse cx="100" cy="122" rx="34" ry="24" fill="#fff" />
      <circle cx="72" cy="96" r="17" fill={INK} />
      <circle cx="128" cy="96" r="17" fill={INK} />
      <circle cx="78" cy="89" r="6" fill="#fff" />
      <circle cx="134" cy="89" r="6" fill="#fff" />
      <circle cx="68" cy="103" r="2.5" fill="#fff" />
      <circle cx="124" cy="103" r="2.5" fill="#fff" />
      <path d="M93 114 h14 l-7 8 z" fill="#ffffff" {...S} strokeWidth="2.5" />
      <path d="M100 122 v6 M100 128 q-8 6 -14 0 M100 128 q8 6 14 0" fill="none" {...S} strokeWidth="2.5" />
      <path d="M40 118 h-26 M42 128 l-24 8 M160 118 h26 M158 128 l24 8" {...S} strokeWidth="2" opacity=".5" />
    </g>
  );
}

// Taps a gavel. `tapping` makes it loop (loading), otherwise one firm bang.
export function JudgeCat({ tapping = false }: { tapping?: boolean }) {
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible" aria-hidden="true" filter="url(#sketch)">
      <path d="M40 210 Q36 150 100 150 Q164 150 160 210 Z" fill="#ffffff" {...S} />
      <CatHead />
      <ellipse cx="52" cy="204" rx="38" ry="9" fill="#141414" {...S} />
      <g className={tapping ? "gavel-tap" : "gavel-bang"} style={{ transformOrigin: "156px 200px" }}>
        <path d="M156 200 L70 186" stroke="#141414" strokeWidth="9" strokeLinecap="round" />
        <rect x="34" y="160" width="26" height="44" rx="6" fill="#141414" {...S} transform="rotate(10 47 182)" />
        <rect x="34" y="176" width="26" height="12" fill="#ffffff" {...S} strokeWidth="2.5" transform="rotate(10 47 182)" />
        <circle cx="158" cy="200" r="14" fill="#fff" {...S} />
      </g>
      <g className="burst" stroke="#141414" strokeWidth="8" strokeLinecap="round">
        <path d="M14 170 l-12 -10 M10 188 l-14 0 M26 156 l-6 -16" />
      </g>
    </svg>
  );
}

export function RefereeCat() {
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible" aria-hidden="true" filter="url(#sketch)">
      <path d="M40 220 Q36 150 100 150 Q164 150 160 220 Z" fill="#ffffff" {...S} />
      <g className="card-raise">
        <path d="M48 168 Q30 120 40 80" stroke="#141414" strokeWidth="28" strokeLinecap="round" />
        <path d="M48 168 Q30 120 40 80" stroke={INK} strokeWidth="4" fill="none" opacity=".0" />
        <rect x="10" y="10" width="54" height="74" rx="6" fill="#e5352b" {...S} transform="rotate(-8 37 47)" />
        <circle cx="42" cy="80" r="15" fill="#ffffff" {...S} />
      </g>
      <CatHead />
      <path d="M86 132 q-6 26 14 34 q20 -8 14 -34" fill="none" stroke={INK} strokeWidth="3" />
      <rect x="100" y="120" width="34" height="14" rx="6" fill="#ffffff" {...S} strokeWidth="3" />
      <path d="M150 120 l14 -6 M152 130 h16 M150 140 l14 6" {...S} strokeWidth="3" />
    </svg>
  );
}

// state: "in" = log sitting in the box, "out" = log rolled out beside it,
// "dropping" / "rolling" animate between the two.
export function LogBox({ state }: { state: "hover" | "dropping" | "in" | "rolling" | "out" }) {
  return (
    <svg viewBox="0 0 320 170" className="h-full w-full overflow-visible" aria-hidden="true" filter="url(#sketch)">
      <path d="M0 160 H320" {...S} />
      <g className={`log log-${state}`}>
        <g transform="rotate(-18 120 60)">
          <rect x="96" y="20" width="48" height="90" rx="10" fill="#ffffff" {...S} />
          <path d="M106 40 v52 M122 32 v66 M134 44 v40" stroke="#141414" strokeWidth="3" />
          <ellipse cx="120" cy="20" rx="24" ry="9" fill="#ffffff" {...S} />
          <path d="M112 20 q8 -6 14 0 q-4 6 -10 2" fill="none" stroke="#141414" strokeWidth="2.5" />
          <path d="M144 70 h12 v-12" fill="#ffffff" {...S} />
        </g>
      </g>
      <g>
        <rect x="40" y="96" width="140" height="64" fill="#ffffff" {...S} />
        <path d="M110 96 v64" {...S} />
        <path d="M40 96 L20 82 L96 82 L110 96 Z M180 96 L200 82 L124 82 L110 96 Z" fill="#ffffff" {...S} />
      </g>
    </svg>
  );
}
