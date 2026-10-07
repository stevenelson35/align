import { useCallback, useMemo, useState } from 'react'
import { AppContext, type AppState, type PendingShift } from '../../context/AppContext'
import { useData } from '../../hooks/useApp'
import { useHashRoute } from '../../hooks/useHashRoute'
import type { Household, HouseholdMember, List, Task } from '../../types'
import { canEditTask } from '../../utils/tasks'
import { ChatPanel } from '../Chat/ChatPanel'
import { ShiftDialog } from '../Dependencies/ShiftDialog'
import { ListEditor } from '../Tasks/ListEditor'
import { TaskDetails } from '../Tasks/TaskDetails'
import { BottomNav } from './BottomNav'
import { MainView } from './MainView'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface Props {
  uid: string
  household: Household
  member: HouseholdMember
}

export function AppShell({ uid, household, member }: Props) {
  const data = useData()
  const [route, navigate] = useHashRoute()
  const [selectedTaskId, selectTask] = useState<string | null>(null)
  const [shift, proposeShift] = useState<PendingShift | null>(null)
  const [listEditor, setListEditor] = useState<{ list: List | null } | null>(null)
  const [chat, setChat] = useState<{ open: boolean; draft: string; key: number }>({ open: false, draft: '', key: 0 })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const canEdit = useCallback((t: Pick<Task, 'visibility' | 'ownerId'>) => canEditTask(t, uid, member.role), [uid, member.role])
  const openChat = useCallback((draft = '') => setChat((c) => ({ open: true, draft, key: c.key + 1 })), [])
  const go = useCallback(
    (r: AppState['route']) => {
      setSidebarOpen(false)
      navigate(r)
    },
    [navigate],
  )

  const app = useMemo<AppState>(
    () => ({
      uid,
      household,
      member,
      isMember: member.role === 'member',
      route,
      navigate: go,
      selectedTaskId,
      selectTask,
      proposeShift,
      editList: (list) => setListEditor({ list }),
      canEdit,
      openChat,
    }),
    [uid, household, member, route, go, selectedTaskId, canEdit, openChat],
  )

  const selectedTask = data.tasks.find((t) => t.id === selectedTaskId)

  return (
    <AppContext.Provider value={app}>
      <div className="app-shell">
        <TopBar
          householdName={household.name}
          member={member}
          onMenu={() => setSidebarOpen((o) => !o)}
          onChat={() => setChat((c) => ({ ...c, open: !c.open }))}
        />
        <div className="app-body">
          <Sidebar open={sidebarOpen} />
          <main className="main-panel">
            {data.error && (
              <p className="error card">
                Couldn't load data: {data.error}{' '}
                <button type="button" className="secondary small" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </p>
            )}
            {data.loaded ? <MainView /> : <p className="muted">Loading…</p>}
          </main>
          {selectedTask && (
            <aside className="right-panel">
              {/* Re-keyed on any change so the form never holds stale dates after a shift is applied. */}
              <TaskDetails key={JSON.stringify(selectedTask)} task={selectedTask} />
            </aside>
          )}
        </div>
        <BottomNav onChat={() => setChat((c) => ({ ...c, open: !c.open }))} />
        {chat.open && <ChatPanel key={chat.key} initialDraft={chat.draft} onClose={() => setChat((c) => ({ ...c, open: false }))} />}
        {shift && <ShiftDialog shift={shift} onClose={() => proposeShift(null)} />}
        {listEditor && <ListEditor list={listEditor.list} onClose={() => setListEditor(null)} />}
      </div>
    </AppContext.Provider>
  )
}
