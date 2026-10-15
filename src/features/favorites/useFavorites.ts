import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Favorites } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { useCurrentUser } from '@/features/auth/useSession'

export function useFavorites() {
  const user = useCurrentUser()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => api.favorites({ signal }),
    enabled: Boolean(user),
  })
}

/**
 * Favoritar com atualização otimista + rollback.
 * Ao falhar, o estado anterior volta e o usuário recebe feedback acessível (toast em região aria-live).
 */
/** NFTs da lista de interesse (página Minha conta › Lista de interesse). */
export function useFavoriteItems() {
  const user = useCurrentUser()
  return useQuery({
    queryKey: qk.favoriteItems(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => api.favoriteItems({ signal }),
    enabled: Boolean(user),
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  const user = useCurrentUser()
  const key = qk.favorites(user?.id ?? 'anonymous')
  return useMutation({
    mutationKey: ['favorite-toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.addFavorite(nftId) : api.removeFavorite(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Favorites>(key)
      const ids = new Set(previous?.nftIds ?? [])
      if (favorite) ids.add(nftId)
      else ids.delete(nftId)
      qc.setQueryData<Favorites>(key, { nftIds: [...ids] })
      return { previous }
    },
    onError: (err, { favorite, name }, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      toast.error(`Não foi possível ${favorite ? 'favoritar' : 'remover dos favoritos'} ${name}.`, {
        description: err instanceof Error ? err.message : undefined,
      })
    },
    onSuccess: (data, { favorite, name }) => {
      qc.setQueryData(key, data)
      // A lista de interesse é reconciliada com o servidor após cada alteração.
      void qc.invalidateQueries({ queryKey: qk.favoriteItems(user?.id ?? 'anonymous') })
      toast.success(favorite ? `${name} adicionado aos favoritos` : `${name} removido dos favoritos`)
    },
  })
}
