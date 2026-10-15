import type { CatalogQuery } from './contracts'

/**
 * Chaves de cache. Dados privados ficam sob ['user', userId, ...] para que
 * troca de usuário/logout limpe tudo com um único removeQueries(['user']).
 * O carrinho é escopado pelo dono (usuário ou id do carrinho visitante).
 */
export const qk = {
  catalog: (q: CatalogQuery) => ['catalog', q] as const,
  catalogAll: ['catalog'] as const,
  nft: (id: string) => ['nft', id] as const,
  nftAll: ['nft'] as const,
  related: (id: string) => ['nft', id, 'related'] as const,
  cart: (owner: string) => ['cart', owner] as const,
  cartAll: ['cart'] as const,
  userAll: ['user'] as const,
  profile: (uid: string) => ['user', uid, 'profile'] as const,
  wallets: (uid: string) => ['user', uid, 'wallets'] as const,
  favorites: (uid: string) => ['user', uid, 'favorites'] as const,
  favoriteItems: (uid: string) => ['user', uid, 'favorite-items'] as const,
  order: (uid: string, id: string) => ['user', uid, 'order', id] as const,
  ordersAll: (uid: string) => ['user', uid, 'order'] as const,
  pendingOrders: (uid: string) => ['user', uid, 'orders', 'pending'] as const,
}
