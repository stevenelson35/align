import type { Household, HouseholdMember } from '../../types'
import { TopBar } from './TopBar'

export function AppShell({ household, member }: { household: Household; member: HouseholdMember }) {
  return (
    <div className="app-shell">
      <TopBar householdName={household.name} member={member} />
      <main className="main-panel">
        <div className="card">
          <h2>Welcome, {member.displayName}</h2>
          <p className="muted">Lists and tasks are coming in the next stage.</p>
        </div>
      </main>
    </div>
  )
}
