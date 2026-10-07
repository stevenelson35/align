import { useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { DataContext } from '../context/DataContext'

export function useApp() {
  const app = useContext(AppContext)
  if (!app) throw new Error('useApp must be used inside AppShell')
  return app
}

export function useData() {
  return useContext(DataContext)
}
