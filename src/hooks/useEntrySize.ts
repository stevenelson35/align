import type { List } from '../types'
import { defaultSize, ENTRY_SIZE_VALUES, sizeKey, type EntrySize } from '../utils/entries'
import { useStoredChoice } from './useStoredChoice'

/** A list's row size, remembered per list on this device (the kind's default until changed). */
export function useEntrySize(list: Pick<List, 'id' | 'kind'>): [EntrySize, (size: EntrySize) => void] {
  return useStoredChoice<EntrySize>(sizeKey(list.id), ENTRY_SIZE_VALUES, defaultSize(list.kind))
}
