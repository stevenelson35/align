import { AppShell } from './components/AppShell/AppShell'
import { AppSkeleton } from './components/AppShell/AppSkeleton'
import { NotAuthorized } from './components/Auth/NotAuthorized'
import { Setup } from './components/Auth/Setup'
import { SignIn } from './components/Auth/SignIn'
import { DataProvider } from './context/DataProvider'
import { useSession } from './hooks/useSession'

function App() {
  const session = useSession()

  switch (session.status) {
    case 'loading':
      return <AppSkeleton bar note={session.step === 'household' ? 'Step 3 of 4: opening your family…' : 'Step 2 of 4: checking your sign-in…'} />
    case 'signedOut':
      return <SignIn />
    case 'unauthorized':
      return <NotAuthorized email={session.user.email} />
    case 'setup':
      return <Setup user={session.user} />
    case 'error':
      return <main className="center error">Something went wrong: {session.message}</main>
    case 'ready':
      return (
        <DataProvider uid={session.user.uid} role={session.member.role} accessChangedAt={session.household.accessChangedAt?.toMillis?.() ?? 0}>
          <AppShell uid={session.user.uid} household={session.household} member={session.member} />
        </DataProvider>
      )
  }
}

export default App
