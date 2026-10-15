/**
 * Armazena a sessão (token opaco + usuário) para recuperação após refresh.
 * Nunca guarda senha. O token é invalidado no servidor no logout/expiração.
 */
import type { Session } from '@/api/contracts'

const KEY = 'kurio:session'
type Listener = () => void

export type SessionState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; session: Session }
  | { status: 'expired'; previousUserId: string }

function read(): SessionState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { status: 'anonymous' }
    const session = JSON.parse(raw) as Session
    if (!session?.token) return { status: 'anonymous' }
    return { status: 'authenticated', session }
  } catch {
    return { status: 'anonymous' }
  }
}

let state: SessionState = read()
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => state,
  subscribe(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  token: () => (state.status === 'authenticated' ? state.session.token : null),
  userId: () => (state.status === 'authenticated' ? state.session.user.id : null),
  set(session: Session) {
    localStorage.setItem(KEY, JSON.stringify(session))
    state = { status: 'authenticated', session }
    emit()
  },
  updateUser(user: Session['user']) {
    if (state.status !== 'authenticated') return
    this.set({ ...state.session, user })
  },
  clear() {
    localStorage.removeItem(KEY)
    state = { status: 'anonymous' }
    emit()
  },
  /** Chamado quando a API responde 401 para um token que tínhamos. */
  expire() {
    if (state.status !== 'authenticated') return
    const previousUserId = state.session.user.id
    localStorage.removeItem(KEY)
    state = { status: 'expired', previousUserId }
    emit()
  },
}

// Sincroniza entre abas (login/logout em outra aba).
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = read()
    emit()
  }
})
