import { useEffect, useRef, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { ApiError, login, signup } from "./api"
import { PasscodeField } from "./PasscodeField"
import type { AuthUser } from "./types"

type AuthScreenProps = {
  onSignedIn: (user: AuthUser) => void
}

type Mode = "login" | "signup"

type LastLogin = {
  email: string
  name: string
}

const LAST_LOGIN = "last-login"

function readLastLogin(): LastLogin | null {
  const raw = localStorage.getItem(LAST_LOGIN)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LastLogin
    if (typeof parsed.email === "string" && typeof parsed.name === "string") return parsed
  } catch {
    return null
  }
  return null
}

function rememberLogin(user: AuthUser) {
  const last: LastLogin = { email: user.email, name: user.name }
  localStorage.setItem(LAST_LOGIN, JSON.stringify(last))
}

export function AuthScreen({ onSignedIn }: AuthScreenProps) {
  const remembered = useRef(readLastLogin())
  const pinRef = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const createPressed = useRef(false)
  const [mode, setMode] = useState<Mode>("login")
  const [motion, setMotion] = useState<"" | "in-left" | "in-right">("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState(remembered.current?.email ?? "")
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (remembered.current?.email) pinRef.current?.focus()
  }, [])

  function switchMode(next: Mode) {
    if (next === mode) return
    setMotion(next === "signup" ? "in-right" : "in-left")
    setMode(next)
    setPasscode("")
    setError(null)
    setShake(false)
  }

  function onPasscode(value: string) {
    setPasscode(value.replace(/\D/g, "").slice(0, 6))
    setShake(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === "signup" && !createPressed.current) return
    createPressed.current = false
    await finish(passcode)
  }

  async function finish(code: string) {
    if (pending.current) return
    if (!/^\d{6}$/.test(code)) {
      setError("Passcode must be a 6 digit number.")
      setShake(true)
      return
    }
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      const user =
        mode === "signup"
          ? await signup(name.trim(), email.trim(), code)
          : await login(email.trim(), code)
      if (!user) return
      rememberLogin(user)
      onSignedIn(user)
    } catch (submitError: unknown) {
      setPasscode("")
      setShake(true)
      setError(submitError instanceof ApiError ? submitError.message : "Could not continue.")
      pinRef.current?.focus()
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const welcome =
    mode === "login" && remembered.current?.name
      ? `Welcome back, ${remembered.current.name}. Enter your 6 digit passcode.`
      : mode === "login"
        ? "Welcome back. Use the email and 6 digit passcode you signed up with."
        : "Create an account. Your notes are encrypted before they are saved."

  return (
    <form className="auth-card" autoComplete="off" onSubmit={(event) => void submit(event)}>
      <div className="views auth-switch" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "is-selected" : ""}
          onClick={() => switchMode("login")}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "is-selected" : ""}
          onClick={() => switchMode("signup")}
        >
          Sign up
        </button>
      </div>
      <div key={mode} className={`auth-fields${motion ? ` ${motion}` : ""}`}>
        <p className="auth-copy">{welcome}</p>
        {mode === "signup" ? (
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              autoComplete="name"
              required
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <PasscodeField
          id="passcode"
          label="Passcode"
          value={passcode}
          onChange={onPasscode}
          autoComplete="off"
          shake={shake}
          inputRef={pinRef}
          onKeyDown={(event) => {
            if (mode === "signup" && event.key === "Enter") event.preventDefault()
          }}
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <button
          type="submit"
          className="primary"
          disabled={busy}
          onClick={() => {
            if (mode === "signup") createPressed.current = true
          }}
        >
          {busy ? <Loader2 size={18} className="spin" /> : null}
          {busy ? "Please wait" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </div>
    </form>
  )
}
