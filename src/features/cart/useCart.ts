import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItemInput, Cart } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { guestCartId } from '@/api/guestCart'
import { qk } from '@/api/queryKeys'
import { useSessionState } from '@/features/auth/useSession'

/** Dono do carrinho no cache: usuário autenticado ou id do carrinho visitante. */
export function useCartOwner() {
  const s = useSessionState()
  return s.status === 'authenticated' ? `user:${s.session.user.id}` : `guest:${guestCartId()}`
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => api.cart({ signal }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })
}

function useCartMutation<TVars>(fn: (v: TVars) => Promise<Cart>, opts: { success?: (v: TVars) => string } = {}) {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, vars) => {
      qc.setQueryData(qk.cart(owner), cart)
      if (opts.success) toast.success(opts.success(vars))
    },
    onError: (err) => {
      // Conflito de disponibilidade: atualiza o carrinho com o estado real do servidor.
      if (err instanceof ApiError && (err.code === 'AVAILABILITY_CONFLICT' || err.status === 404)) {
        void qc.invalidateQueries({ queryKey: qk.cart(owner) })
      }
    },
  })
}

export function useAddToCart() {
  return useCartMutation((input: AddCartItemInput) => api.addToCart(input), {
    success: (v) => `${v.quantity} ${v.quantity > 1 ? 'edições adicionadas' : 'edição adicionada'} ao carrinho`,
  })
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => api.removeCartItem(itemId), { success: () => 'Item removido do carrinho' })
}

export function useAcknowledgeCart() {
  return useCartMutation(() => api.acknowledgeCart(), { success: () => 'Carrinho atualizado com os valores atuais' })
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => api.applyCoupon(code), {
    success: (c) => `Cupom ${c.toUpperCase()} aplicado`,
  })
}

export function useRemoveCoupon() {
  return useCartMutation(() => api.removeCoupon(), { success: () => 'Cupom removido' })
}

/**
 * Atualização otimista da quantidade: a UI reflete na hora e faz rollback se o
 * servidor recusar (ex.: disponibilidade insuficiente). Totais vêm sempre da API.
 */
export function useUpdateCartQuantity() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => api.updateCartItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await qc.cancelQueries({ queryKey: qk.cart(owner) })
      const previous = qc.getQueryData<Cart>(qk.cart(owner))
      if (previous) {
        qc.setQueryData<Cart>(qk.cart(owner), {
          ...previous,
          items: previous.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
        })
      }
      return { previous }
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.cart(owner), ctx.previous)
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar a quantidade')
    },
    onSuccess: (cart) => qc.setQueryData(qk.cart(owner), cart),
  })
}
