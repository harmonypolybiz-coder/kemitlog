import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

const CONTROL =
  'min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-base text-fg placeholder:text-subtle focus:border-accent sm:text-sm'

function FieldLabel({ htmlFor, label, hint }: { htmlFor: string; label: string; hint?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
}

export function TextField({ label, hint, className = '', ...props }: TextFieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <input id={id} className={CONTROL} {...props} />
    </div>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: ReactNode
}

export function TextAreaField({ label, hint, className = '', ...props }: TextAreaFieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <textarea id={id} className={`${CONTROL} resize-y py-2.5`} {...props} />
    </div>
  )
}

interface SelectFieldProps<T extends string | number>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  label: string
  hint?: ReactNode
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}

export function SelectField<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
  className = '',
  ...props
}: SelectFieldProps<T>) {
  const id = useId()
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <select
        id={id}
        className={CONTROL}
        value={String(value)}
        onChange={(event) => {
          const selected = options.find((option) => String(option.value) === event.target.value)
          if (selected) onChange(selected.value)
        }}
        {...props}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
