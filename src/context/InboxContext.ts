import { createContext } from 'react'
import type { InboxMessage } from '../firebase/inbox'

export interface InboxState {
  messages: InboxMessage[]
  unread: number
  error: string | null
  loaded: boolean
}

export const InboxContext = createContext<InboxState>({ messages: [], unread: 0, error: null, loaded: false })
