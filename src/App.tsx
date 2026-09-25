import { AppShell } from './components/AppShell/AppShell'
import { NotAuthorized } from './components/Auth/NotAuthorized'
import { SignIn } from './components/Auth/SignIn'
import { useSession } from './hooks/useSession'

function App() {
  const session = useSession()

  switch (session.status) {
    case 'loading':
      return <main className="center muted">Loading…</main>
    case 'signedOut':
      return <SignIn />
    case 'unauthorized':
      return <NotAuthorized email={session.user.email} />
    case 'error':
      return <main className="center error">Something went wrong: {session.message}</main>
    case 'ready':
      return <AppShell household={session.household} member={session.member} />
  }
}

export default App
