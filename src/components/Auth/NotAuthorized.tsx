import { signOut } from '../../firebase/auth'

export function NotAuthorized({ email }: { email: string | null }) {
  return (
    <main className="center">
      <div className="card">
        <h1>Not in this household</h1>
        <p>
          {email ?? 'This account'} can sign in, but hasn't been added to the household yet. Ask Steve to add you.
        </p>
        <button type="button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </main>
  )
}
