import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { subscribeInbox, type InboxMessage } from '../firebase/inbox'
import { InboxContext } from './InboxContext'

/** Your Inbox, listened to while you're signed in (the badge, the Inbox tile and the "new message" banner share it). */
export function InboxProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [state, setState] = useState<{ uid: string; messages: InboxMessage[]; error: string | null; loaded: boolean }>({ uid, messages: [], error: null, loaded: false })
  useEffect(
    () =>
      subscribeInbox(
        uid,
        (messages) => setState({ uid, messages, error: null, loaded: true }),
        (error) => setState((s) => ({ ...s, uid, error, loaded: true })),
      ),
    [uid],
  )
  const value = useMemo(() => {
    const messages = state.uid === uid ? state.messages : []
    return { messages, unread: messages.filter((m) => !m.read).length, error: state.uid === uid ? state.error : null, loaded: state.uid === uid && state.loaded }
  }, [state, uid])
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}
