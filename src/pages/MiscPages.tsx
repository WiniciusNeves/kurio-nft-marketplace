import { Link, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

const SECTIONS: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  atividade: 'Atividade',
  'lista-de-interesse': 'Lista de interesse',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
  suporte: 'Suporte',
  ajuda: 'Central de ajuda',
  diario: 'Diário da Cunhagem',
  'minha-colecao': 'Minha coleção',
  estudio: 'Estúdio do criador',
}

/** Seções fora do escopo do desafio: comunicam isso claramente, sem simular sucesso. */
export function ComingSoonPage() {
  const { secao } = useSearch({ from: '/em-breve' })
  const name = (secao && SECTIONS[secao]) || 'Esta seção'
  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center" data-testid="coming-soon">
      <h1 className="text-2xl font-bold">{name}</h1>
      <p className="max-w-md text-muted">Esta área não faz parte desta entrega. Explore o mercado enquanto isso.</p>
      <Button asChild>
        <Link to="/mercado">Ir para o mercado</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center" data-testid="not-found">
      <p className="text-6xl font-bold text-primary-strong">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-muted">O endereço acessado não existe. Verifique o link ou volte ao início.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}
