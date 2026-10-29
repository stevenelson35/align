import { useState } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import { CombinedView } from './CombinedView'

type Whose = 'all' | 'mine' | 'family' | 'shared' | 'work'

/**
 * Tasks: every task you can see, across all lists, with the combined view's filters, plus whose: All, Mine (your
 * private lists), Family, Shared, and Work only when something is marked work. The old Everything / My tasks /
 * Family tasks / Work pages open here with that choice.
 */
export function TasksView({ initial }: { initial: Whose }) {
  const { uid } = useApp()
  const { tasks, lists } = useData()
  const [whose, setWhose] = useState<Whose>(initial)
  const hasWork = tasks.some((t) => t.context === 'work') || lists.some((l) => l.defaultContext === 'work')
  const choices: { value: Whose; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Mine' },
    { value: 'family', label: 'Family' },
    { value: 'shared', label: 'Shared' },
    ...(hasWork ? [{ value: 'work' as const, label: 'Work' }] : []),
  ]
  const shown = tasks.filter((t) =>
    whose === 'mine'
      ? t.visibility === 'private' && t.ownerId === uid
      : whose === 'family'
        ? t.visibility === 'family'
        : whose === 'shared'
          ? t.visibility === 'shared'
          : whose === 'work'
            ? t.context === 'work'
            : true,
  )
  return (
    <>
      <div className="chip-filter small tasks-whose" role="group" aria-label="Whose tasks">
        {choices.map((c) => (
          <button key={c.value} type="button" className={`chip-toggle${whose === c.value ? ' on' : ''}`} onClick={() => setWhose(c.value)} aria-pressed={whose === c.value}>
            {c.label}
          </button>
        ))}
      </div>
      <CombinedView key={whose} title="Tasks" tasks={shown} showContext={hasWork} />
    </>
  )
}
