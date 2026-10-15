import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { LoginInput, RegisterInput, Session } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { guestCartId, rotateGuestCartId } from '@/api/guestCart'
import { qk } from '@/api/queryKeys'
import { clearCheckoutDrafts } from '@/features/checkout/checkoutStorage'
import { sessionStore } from './sessionStore'

/**
 * Pós-autenticação:
 * 1. remove do cache qualquer dado privado de outro usuário (troca de conta);
 * 2. grava a sessão (o RealtimeBridge recria o socket com o novo token);
 * 3. mescla o carrinho do visitante no carrinho do usuário (itens preservados).
 */
export function useOnAuthenticated() {
  const qc = useQueryClient()
  return async (session: Session) => {
    qc.removeQueries({ queryKey: qk.userAll, predicate: (q) => q.queryKey[1] !== session.user.id })
    qc.removeQueries({ queryKey: qk.cartAll })
    sessionStore.set(session)
    try {
      const cart = await api.mergeCart(guestCartId())
      rotateGuestCartId()
      qc.setQueryData(qk.cart(`user:${session.user.id}`), cart)
    } catch {
      // Falha transitória: o carrinho será buscado normalmente; o visitante mantém seu id para nova tentativa.
    }
  }
}

export function useLogin() {
  const onAuth = useOnAuthenticated()
  return useMutation({
    mutationFn: (input: LoginInput) => api.login(input),
    onSuccess: onAuth,
  })
}

export function useRegister() {
  const onAuth = useOnAuthenticated()
  return useMutation({
    mutationFn: (input: RegisterInput) => api.register(input),
    onSuccess: onAuth,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async () => {
      try {
        await api.logout()
      } catch {
        /* mesmo offline, a sessão local é encerrada */
      }
    },
    onSettled: () => {
      sessionStore.clear()
      // Dados privados e carrinho do usuário saem do cache; socket é recriado como anônimo.
      qc.removeQueries({ queryKey: qk.userAll })
      qc.removeQueries({ queryKey: qk.cartAll })
      clearCheckoutDrafts()
      // Callbacks no nível do hook rodam mesmo com a tela privada já desmontada.
      toast.success('Você saiu da sua conta')
      void navigate({ to: '/' })
    },
  })
}
