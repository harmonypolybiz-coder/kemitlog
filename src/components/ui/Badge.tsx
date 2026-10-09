import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'demo'

const TONES: Record<Tone, string> = {
  neutral: 'bg-raised text-muted',
  accent: 'bg-accent/15 text-accent',
  demo: 'bg-demo/15 text-demo',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
