import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext, type AppState, type PendingShift } from '../../context/AppContext'
import { useData } from '../../hooks/useApp'
import { useHashRoute } from '../../hooks/useHashRoute'
import type { Household, HouseholdMember, List } from '../../types'
import { canEditTask, type Shareable } from '../../utils/tasks'
import { ChatPanel } from '../Chat/ChatPanel'
import { ShiftDialog } from '../Dependencies/ShiftDialog'
import { ListEditor } from '../Tasks/ListEditor'
import { ItemDetails } from '../Tasks/ItemDetails'
import { TaskDetails } from '../Tasks/TaskDetails'
import { AppSkeleton } from './AppSkeleton'
import { BottomNav } from './BottomNav'
import { SearchDialog } from './SearchDialog'
import { SettingsDialog } from './SettingsDialog'
import { MainView } from './MainView'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { routeHash } from '../../utils/routes'
import { MENU_OPEN_KEY } from '../../utils/menu'

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
  // Settings belongs to the page it was opened on: going to another page (e.g. "More in Help" in a tip) closes it.
  const [settingsOpen, setSettingsOpen] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [textingId, setTextingId] = useState<string | null>(null)
  // The breadcrumb's "Menu" / "Links": open the menu with that section expanded. The menu reads its open section
  // when it mounts, so it's stored and the menu remounted.
  const [menuKey, setMenuKey] = useState(0)
  const openMenu = useCallback((section?: string) => {
    if (section) localStorage.setItem(MENU_OPEN_KEY, section)
    setMenuKey((k) => k + 1)
    setSidebarOpen(true)
  }, [])
  const openSettings = useCallback(() => {
    setSidebarOpen(false)
    setSettingsOpen(routeHash(route))
  }, [route])

  const canEdit = useCallback((t: Shareable) => canEditTask(t, uid, member.role), [uid, member.role])
  const openChat = useCallback((draft = '') => setChat((c) => ({ open: true, draft, key: c.key + 1 })), [])
  const go = useCallback(
    (r: AppState['route']) => {
      setSidebarOpen(false)
      selectTask(null) // on a phone the task panel covers the page, so a new view must not open behind it
      navigate(r)
    },
    [navigate],
  )

  // A link to one task (#/task/<id>, e.g. from a text) shows its list with that task open. Derived, not stored:
  // picking another task or closing the panel moves to the plain list address.
  const linked =
    route.view === 'task' ? (data.tasks.find((t) => t.id === route.taskId) ?? data.listItems.find((t) => t.id === route.taskId)) : undefined
  const shownTaskId = linked ? linked.id : selectedTaskId
  const choose = useCallback(
    (id: string | null) => {
      if (route.view === 'task') navigate(linked ? { view: 'list', listId: linked.listId, timeline: false } : { view: 'today' })
      selectTask(id)
      setTextingId(null)
    },
    [route.view, linked, navigate],
  )
  const textAbout = useCallback(
    (id: string) => {
      choose(id)
      setTextingId(id)
    },
    [choose],
  )

  const app = useMemo<AppState>(
    () => ({
      uid,
      household,
      member,
      isMember: member.role === 'member',
      route,
      navigate: go,
      selectedTaskId: shownTaskId,
      selectTask: choose,
      textAbout,
      textingId,
      openSettings,
      openMenu,
      proposeShift,
      editList: (list) => setListEditor({ list }),
      canEdit,
      openChat,
    }),
    [uid, household, member, route, go, shownTaskId, choose, textAbout, textingId, openSettings, openMenu, canEdit, openChat],
  )

  const selectedTask = data.tasks.find((t) => t.id === shownTaskId)
  const selectedItem = selectedTask ? undefined : data.listItems.find((t) => t.id === shownTaskId)
  const selectedItemList = selectedItem && data.lists.find((l) => l.id === selectedItem.listId)

  // Keyboard shortcuts (desktop): "/" search, "n" new task (chat quick add), "t" today. Not while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'n' && member.role === 'member') {
        e.preventDefault()
        openChat('add task ')
      } else if (e.key === 't') {
        go({ view: 'today' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, openChat, member.role])

  // A new page starts at the top (picking a list lower down the menu used to leave you scrolled down).
  const mainRef = useRef<HTMLElement>(null)
  // Moving between Help topics stays on the same page (it scrolls to the topic itself).
  const pageKey = route.view === 'task' ? 'task' : route.view === 'help' ? 'help' : JSON.stringify(route)
  useEffect(() => {
    window.scrollTo(0, 0)
    mainRef.current?.scrollTo?.(0, 0)
  }, [pageKey])

  // Escape closes the phone menu, like tapping outside it.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  return (
    <AppContext.Provider value={app}>
      <div className="app-shell">
        <TopBar
          member={member}
          onMenu={() => setSidebarOpen((o) => !o)}
          onChat={() => setChat((c) => ({ ...c, open: !c.open }))}
          onSettings={openSettings}
          onSearch={() => setSearchOpen(true)}
        />
        <div className="app-body">
          <Sidebar key={menuKey} open={sidebarOpen} onSettings={openSettings} />
          {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
          <main className="main-panel" ref={mainRef}>
            {data.error && (
              <p className="error card">
                Couldn't load data: {data.error}{' '}
                <button type="button" className="secondary small" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </p>
            )}
            {data.loaded ? <MainView /> : <AppSkeleton note="Loading your lists…" />}
          </main>
          {selectedTask && (
            <aside className="right-panel">
              {/* Re-keyed on any change so the form never holds stale dates after a shift is applied. */}
              <TaskDetails key={JSON.stringify(selectedTask)} task={selectedTask} />
            </aside>
          )}
          {selectedItem && selectedItemList && (
            <aside className="right-panel">
              <ItemDetails key={selectedItem.id} item={selectedItem} list={selectedItemList} />
            </aside>
          )}
        </div>
        <BottomNav onChat={() => setChat((c) => ({ ...c, open: !c.open }))} />
        {chat.open && <ChatPanel key={chat.key} initialDraft={chat.draft} onClose={() => setChat((c) => ({ ...c, open: false }))} />}
        {shift && <ShiftDialog shift={shift} onClose={() => proposeShift(null)} />}
        {listEditor && <ListEditor list={listEditor.list} onClose={() => setListEditor(null)} />}
        {settingsOpen === routeHash(route) && <SettingsDialog onClose={() => setSettingsOpen(null)} />}
        {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      </div>
    </AppContext.Provider>
  )
}
