// A stick figure lounging on the floor, kicking its feet while it waits.
export default function StickMan({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center" role="status" aria-label={label ?? "Loading"}>
      <svg viewBox="0 0 120 72" className="h-24 w-40" aria-hidden="true" filter="url(#sketch)">
        <g stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* body, from shoulder to hip */}
          <path d="M72 54 L30 60" />
          {/* thigh up to the knee, then two kicking shins */}
          <path d="M30 60 L42 32" />
          <path className="lounge-shin-a" d="M42 32 L22 28" />
          <path className="lounge-shin-b" d="M42 32 L20 37" />
          {/* arm propping up the head */}
          <path d="M72 54 L88 62 L97 46" />
          {/* head */}
          <g className="lounge-head">
            <circle cx="86" cy="34" r="14" fill="#fff" />
            <circle className="lounge-eye" cx="81" cy="31" r="1.4" fill="#141414" stroke="none" />
            <circle className="lounge-eye" cx="91" cy="31" r="1.4" fill="#141414" stroke="none" />
            <path d="M80 38 Q86 44 92 38" strokeWidth="2.4" />
          </g>
        </g>
        {/* thinking dots */}
        <g fill="#141414">
          <circle className="lounge-dot" cx="104" cy="16" r="1.6" />
          <circle className="lounge-dot" cx="110" cy="11" r="1.6" style={{ animationDelay: "0.2s" }} />
          <circle className="lounge-dot" cx="116" cy="6" r="1.6" style={{ animationDelay: "0.4s" }} />
        </g>
        <path d="M8 66 H112" stroke="#141414" strokeWidth="1" />
      </svg>
      {label && <p className="mt-2 text-sm text-[#141414]/70">{label}</p>}
    </div>
  );
}
