import { useState, type FormEvent } from 'react'
import { sendPasswordReset, signIn } from '../../firebase/auth'

/** Sign in, or (Forgot password?) get a reset link by email. */
export function SignIn() {
  const [mode, setMode] = useState<'signIn' | 'reset'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNote(null)
    if (mode === 'reset') {
      try {
        await sendPasswordReset(email)
      } catch {
        // Same message either way (see sendPasswordReset); only a badly typed address is worth pointing out.
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
          setError('That doesn’t look like an email address.')
          setBusy(false)
          return
        }
      }
      setNote(`If ${email.trim()} has an Align account, a link to choose a new password is on its way. Check spam if it doesn’t arrive in a few minutes.`)
      setBusy(false)
      return
    }
    try {
      await signIn(email, password)
    } catch {
      setError('That email and password did not match.')
      setBusy(false)
    }
  }

  const switchTo = (m: 'signIn' | 'reset') => {
    setMode(m)
    setError(null)
    setNote(null)
  }

  return (
    <main className="center">
      <form className="card sign-in" onSubmit={handleSubmit}>
        <h1>Align</h1>
        {mode === 'reset' && <p className="muted small">Enter your email and we’ll send a link to choose a new password.</p>}
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode === 'signIn' && (
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        {note && <p className="small" role="status">{note}</p>}
        <button type="submit" disabled={busy}>
          {mode === 'reset' ? (busy ? 'Sending…' : 'Send reset link') : busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="link small" onClick={() => switchTo(mode === 'signIn' ? 'reset' : 'signIn')}>
          {mode === 'signIn' ? 'Forgot password?' : 'Back to sign in'}
        </button>
      </form>
    </main>
  )
}
