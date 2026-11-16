import { useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { ApiError, resetPasscode } from "./api"
import { PasscodeField } from "./PasscodeField"

type ResetPasscodeProps = {
  onClose: () => void
}

export function ResetPasscode({ onClose }: ResetPasscodeProps) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.stopImmediatePropagation()
      onClose()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(current) || !/^\d{6}$/.test(next)) {
      setError("Each passcode must be a 6 digit number.")
      return
    }
    if (current === next) {
      setError("Choose a different passcode.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await resetPasscode(current, next)
      setSaved(true)
    } catch (submitError: unknown) {
      setError(submitError instanceof ApiError ? submitError.message : "Could not reset the passcode.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <form className="confirm reset-card" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void submit(event)}>
        <h2>Change passcode</h2>
        {saved ? (
          <>
            <p>Your passcode is updated. Use the new one the next time you log in.</p>
            <div className="confirm-actions">
              <button type="button" className="primary" onClick={onClose} autoFocus>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Enter the current 6 digit passcode, then choose a new one.</p>
            <PasscodeField
              id="current-passcode"
              label="Current passcode"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
            <PasscodeField
              id="new-passcode"
              label="New passcode"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
            />
            {error ? <p className="auth-error">{error}</p> : null}
            <div className="confirm-actions">
              <button type="button" className="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : null}
                {busy ? "Saving" : "Save passcode"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
