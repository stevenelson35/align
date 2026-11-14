import { useGameChallenges, useWordleChallengeProgress, useWordleChallengeUpdates } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { useStoredChoice } from '../../hooks/useStoredChoice'
import { PendingGameInvitations } from './PendingGameInvitations'

const SECTIONS = ['invitations', 'live-updates', 'none'] as const
type Section = (typeof SECTIONS)[number]

/**
 * Your game invitations and live Wordle updates, each a heading that opens (one at a time, remembered on this
 * device). On Today's Games panel and at the top of the Games page (where an Inbox game invitation takes you).
 * Listens only while `enabled` (a folded panel costs no reads).
 */
export function GameInvitationsBlock({ enabled = true }: { enabled?: boolean }) {
  const app = useApp()
  const [open, setOpen] = useStoredChoice<Section>('align-today-games-panel-section', SECTIONS, 'invitations')
  const on = app.isMember && enabled
  const { challenges, error: challengeError, loaded } = useGameChallenges(app.uid, on)
  const { challenges: wordleChallenges, error: wordleError } = useWordleChallengeUpdates(app.uid, on)
  const { progress, error: progressError } = useWordleChallengeProgress(app.uid, on)
  if (!app.isMember) return null
  return (
    <PendingGameInvitations
      challenges={challenges}
      wordleChallenges={wordleChallenges}
      progress={progress}
      loaded={loaded}
      errors={[challengeError, wordleError, progressError].filter((message): message is string => !!message)}
      invitationsOpen={open === 'invitations'}
      liveUpdatesOpen={open === 'live-updates'}
      onToggleInvitations={() => setOpen(open === 'invitations' ? 'none' : 'invitations')}
      onToggleLiveUpdates={() => setOpen(open === 'live-updates' ? 'none' : 'live-updates')}
    />
  )
}
