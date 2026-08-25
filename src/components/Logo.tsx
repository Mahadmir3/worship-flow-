export function Logo({ className, mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={mono ? "#C9952E" : "#323A8C"} />
      <path
        d="M10 30c3.5 0 3.5-12 7-12s3.5 12 7 12 3.5-12 7-12 3.5 12 7 12"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
