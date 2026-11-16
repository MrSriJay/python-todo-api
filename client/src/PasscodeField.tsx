import { useState, type KeyboardEvent, type Ref } from "react"
import { Eye, EyeOff } from "lucide-react"

type PasscodeFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: "current-password" | "new-password" | "off"
  shake?: boolean
  inputRef?: Ref<HTMLInputElement>
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function PasscodeField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  shake = false,
  inputRef,
  onKeyDown,
}: PasscodeFieldProps) {
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const nextIndex = value.length < 6 ? value.length : -1

  return (
    <label className="pin" htmlFor={id}>
      {label}
      <span className="pin-well">
        <span className={`pin-dots${shake ? " is-shaking" : ""}`} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => {
            const digit = value[index] ?? ""
            const filled = index < value.length
            return (
              <span
                key={index}
                className={`pin-dot${filled && !visible ? " is-filled" : ""}${
                  filled && visible ? " is-digit" : ""
                }${focused && index === nextIndex ? " is-current" : ""}${
                  index === value.length - 1 ? " is-new" : ""
                }`}
              >
                {visible ? digit : ""}
              </span>
            )
          })}
        </span>
        <button
          type="button"
          className="pin-eye"
          aria-label={visible ? "Hide passcode" : "Show passcode"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        <input
          id={id}
          ref={inputRef}
          className="pin-input"
          type="text"
          inputMode="numeric"
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          maxLength={6}
          aria-label={`${label}, 6 digit passcode`}
          required
        />
      </span>
    </label>
  )
}
