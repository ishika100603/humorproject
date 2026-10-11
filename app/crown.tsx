// A simple crown used as the points icon
export default function Crown({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" className={className} aria-hidden="true">
      <path
        d="M2 6 L6.5 11 L12 3 L17.5 11 L22 6 L20 16 H4 Z"
        fill="#1d4f91"
        stroke="#141414"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="4" y="16" width="16" height="2.6" rx="0.8" fill="#1d4f91" stroke="#141414" strokeWidth="1.2" />
      <circle cx="2" cy="6" r="1.4" fill="#fff" stroke="#141414" strokeWidth="1" />
      <circle cx="12" cy="3" r="1.4" fill="#fff" stroke="#141414" strokeWidth="1" />
      <circle cx="22" cy="6" r="1.4" fill="#fff" stroke="#141414" strokeWidth="1" />
    </svg>
  );
}
