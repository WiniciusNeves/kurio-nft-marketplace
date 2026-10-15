import type { ReactNode } from 'react'
import { useCurrentUser } from '@/features/auth/useSession'

/**
 * Renderiza a tela privada apenas com usuário autenticado. Se a sessão expirar com a tela aberta,
 * o conteúdo é desmontado imediatamente (nenhum dado privado fica visível) e o RootLayout leva ao login.
 */
export function Protected({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  if (!user) return null
  return <>{children}</>
}
