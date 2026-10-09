interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}

/** Bascule entre quelques vues exclusives. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-xl bg-raised p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
            value === option.value ? 'bg-canvas text-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
