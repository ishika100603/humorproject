// A little stick figure walking along a line, carrying a sticky note.
export default function StickMan({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center" role="status" aria-label={label ?? "Loading"}>
      <div className="stickman-track relative h-24 w-56 overflow-hidden">
        <svg viewBox="0 0 60 80" className="stickman absolute bottom-1 h-20 w-16" aria-hidden="true" filter="url(#sketch)">
          <g stroke="#141414" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <circle cx="30" cy="12" r="7" fill="#fff" />
            <path d="M30 19 V46" />
            <path className="sm-arm-a" d="M30 26 L42 20" />
            <path className="sm-arm-b" d="M30 26 L20 36" />
            <path className="sm-leg-a" d="M30 46 L22 66" />
            <path className="sm-leg-b" d="M30 46 L38 66" />
          </g>
          <rect x="38" y="6" width="18" height="16" fill="#f6eebc" stroke="#141414" strokeWidth="1.4" transform="rotate(8 47 14)" />
        </svg>
        <div className="absolute inset-x-0 bottom-1 h-px bg-[#141414]" />
      </div>
      {label && <p className="mt-2 text-sm text-[#141414]/70">{label}</p>}
    </div>
  );
}
