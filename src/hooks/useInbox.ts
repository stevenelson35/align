import { useContext } from 'react'
import { InboxContext } from '../context/InboxContext'

/** Your Inbox: messages (newest first), how many are unread, and any loading error. */
export const useInbox = () => useContext(InboxContext)
