export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 512 512" className="size-8 rounded-lg" aria-hidden>
        <rect width="512" height="512" className="fill-raised" />
        <g className="fill-accent">
          <rect x="150" y="136" width="56" height="240" rx="10" />
          <path d="M222 256 318 136h70L292 256l96 120h-70z" />
        </g>
      </svg>
      <span className="font-display text-2xl leading-none font-bold tracking-wider">
        KEMIT<span className="text-accent">LOG</span>
      </span>
    </span>
  )
}
