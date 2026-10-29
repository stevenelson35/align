import { useState } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import { whoseMatches, type Whose } from '../../utils/whose'
import { WhoseChips } from '../UI/WhoseChips'
import { CombinedView } from './CombinedView'

type Choice = Whose | 'work'

/**
 * Tasks: every task you can see, across all lists and dates, with the combined view's filters, plus whose (the same
 * chips as Today's To Do, which shows just today's): All, Mine, Family, Shared, and Work only when something is
 * marked work. The old Everything / My tasks / Family tasks / Work pages open here with that choice.
 */
export function TasksView({ initial }: { initial: Choice }) {
  const { uid } = useApp()
  const { tasks, lists } = useData()
  const [whose, setWhose] = useState<Choice>(initial)
  const hasWork = tasks.some((t) => t.context === 'work') || lists.some((l) => l.defaultContext === 'work')
  const shown = tasks.filter((t) => (whose === 'work' ? t.context === 'work' : whoseMatches(t, whose, uid)))
  return (
    <>
      <WhoseChips<Choice> value={whose} onChange={setWhose} extra={hasWork ? [{ value: 'work', label: 'Work' }] : []} label="Whose tasks" />
      <CombinedView key={whose} title="Tasks" tasks={shown} showContext={hasWork} />
    </>
  )
}
