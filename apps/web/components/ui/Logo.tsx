/** LoCap mark: two caption lines with the active word lit, plus the wordmark. Same artwork as app/icon.svg. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-display font-semibold text-lg tracking-tight">
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#06d6a0" />
        <rect x="7" y="11" width="18" height="3.5" rx="1.75" fill="#03241b" />
        <rect x="7" y="18" width="7" height="3.5" rx="1.75" fill="#03241b" />
        <rect x="16" y="17" width="9" height="5.5" rx="2" fill="#ffffff" />
      </svg>
      <span>Lo<span className="text-primary">Cap</span></span>
    </span>
  );
}
