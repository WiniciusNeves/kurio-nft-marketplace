import { useSyncExternalStore } from 'react'
import { sessionStore } from './sessionStore'

export function useSessionState() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

export function useCurrentUser() {
  const s = useSessionState()
  return s.status === 'authenticated' ? s.session.user : null
}
