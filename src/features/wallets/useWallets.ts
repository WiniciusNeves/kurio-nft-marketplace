import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { NETWORK_LABEL, WALLET_PROVIDER_LABEL, type Network, type WalletProvider } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'

/** Carteiras cadastradas do usuário. */
export function useWallets(userId: string) {
  return useQuery({ queryKey: qk.wallets(userId), queryFn: ({ signal }) => api.listWallets({ signal }) })
}

/** Abre uma sessão da carteira na rede escolhida. O chamador guarda a sessão via `mutate(vars, { onSuccess })`. */
export function useConnectWallet() {
  return useMutation({
    mutationFn: ({ walletId, network, provider }: { walletId: string; network: Network; provider: WalletProvider }) =>
      api.connectWallet(walletId, network, provider),
    onSuccess: (s) => {
      toast.success(`${WALLET_PROVIDER_LABEL[s.provider]} conectada na rede ${NETWORK_LABEL[s.network]}`)
    },
    onError: (e) => toast.error(e.message),
  })
}

/**
 * Encerra a sessão no servidor. A UI já trata a carteira como desconectada;
 * se o servidor falhar, o usuário é avisado em vez de o erro ser engolido.
 */
export function useDisconnectWallet() {
  return useMutation({
    mutationFn: (sessionId: string) => api.disconnectWallet(sessionId),
    onError: (e) =>
      toast.error('Não foi possível encerrar a sessão da carteira no servidor.', {
        description: e instanceof Error ? e.message : undefined,
      }),
  })
}
