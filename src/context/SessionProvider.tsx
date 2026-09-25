import { useEffect, useState, type ReactNode } from 'react'
import { onAuthChange } from '../firebase/auth'
import { subscribeHousehold } from '../firebase/db'
import { SessionContext, type SessionState } from './SessionContext'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    let unsubHousehold: (() => void) | undefined

    const unsubAuth = onAuthChange((user) => {
      unsubHousehold?.()
      unsubHousehold = undefined
      if (!user) {
        setState({ status: 'signedOut' })
        return
      }
      setState({ status: 'loading' })
      unsubHousehold = subscribeHousehold(
        (household) => {
          const member = household.members[user.uid]
          setState(member ? { status: 'ready', user, household, member } : { status: 'unauthorized', user })
        },
        // The rules deny household/main to anyone not listed in it.
        (error) =>
          setState(
            error.code === 'permission-denied'
              ? { status: 'unauthorized', user }
              : { status: 'error', message: error.message },
          ),
      )
    })

    return () => {
      unsubHousehold?.()
      unsubAuth()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}
