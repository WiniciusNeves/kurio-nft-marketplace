import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  FacebookIcon as Facebook,
  InstagramIcon as Instagram,
  LinkedinIcon as Linkedin,
  TwitterIcon as Twitter,
  YoutubeIcon as Youtube,
} from '@/components/icons'
import { WalletBadges } from '@/components/WalletBadges'

const FEATURES = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', Icon: Facebook },
  { label: 'Instagram', href: 'https://www.instagram.com', Icon: Instagram },
  { label: 'Twitter', href: 'https://x.com', Icon: Twitter },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', Icon: Linkedin },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: Youtube },
]

const soon = (secao: string) => ({ to: '/em-breve' as const, search: { secao } })

export function Footer() {
  return (
    <footer className="container-page mt-24 mb-8">
      <section
        aria-label="Destaques da Kurio"
        className="grid grid-cols-[minmax(0,1fr)] gap-8 bg-surface px-6 py-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr] lg:px-12"
      >
        {FEATURES.map((f) => (
          <div key={f.letter} className="lg:border-r lg:border-primary lg:pr-6">
            <div
              className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
              aria-hidden
            >
              {f.letter}
            </div>
            <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.text}</p>
          </div>
        ))}
        <div>
          <h2 className="text-lg leading-tight font-bold">Antecipe-se ao próximo lançamento</h2>
          <form
            className="mt-4 flex"
            onSubmit={(e) => {
              e.preventDefault()
              toast.info('A newsletter não faz parte desta demonstração — nenhum e-mail foi cadastrado.')
            }}
          >
            <label htmlFor="newsletter" className="sr-only">
              Seu e-mail
            </label>
            <input
              id="newsletter"
              type="email"
              required
              placeholder="digite seu e-mail..."
              className="h-10 min-w-0 flex-1 bg-band px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-primary-strong"
            />
            <button type="submit" className="h-10 bg-primary px-4 text-base font-bold text-primary-foreground">
              Enviar
            </button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 bg-band px-6 py-6 text-sm sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:items-center">
        <span className="font-bold tracking-[0.2em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <a href="mailto:contato@email.com" className="hover:text-primary-strong">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-primary-strong">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 bg-surface px-6 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <nav aria-labelledby="f-perfil">
          <h2 id="f-perfil" className="text-lg font-bold">
            Meu perfil
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/account/profile" className="hover:text-primary-strong">
                Meu perfil
              </Link>
            </li>
            <li>
              <Link {...soon('minha-colecao')} className="hover:text-primary-strong">
                Minha coleção
              </Link>
            </li>
            <li>
              <Link {...soon('atividade')} className="hover:text-primary-strong">
                Atividade
              </Link>
            </li>
            <li>
              <Link {...soon('estudio')} className="hover:text-primary-strong">
                Estúdio do criador
              </Link>
            </li>
            <li>
              <Link to="/account/favorites" className="hover:text-primary-strong">
                Lista de interesse
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="f-ajuda">
          <h2 id="f-ajuda" className="text-lg font-bold">
            Central de ajuda
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              'Central de ajuda',
              'Como comprar NFTs',
              'Carteira e segurança',
              'Política do mercado',
              'Denunciar item',
            ].map((l) => (
              <li key={l}>
                <Link {...soon('ajuda')} className="hover:text-primary-strong">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="f-colecoes">
          <h2 id="f-colecoes" className="text-lg font-bold">
            Coleções
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(
              [
                ['arte-digital', 'Arte digital'],
                ['fotografia', 'Fotografia'],
                ['musica', 'Música'],
                ['arte-3d', 'Arte 3D'],
                ['utilidade', 'Utilidade'],
              ] as const
            ).map(([c, l]) => (
              <li key={c}>
                <Link to="/mercado" search={{ category: [c] }} className="hover:text-primary-strong">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-lg font-bold">Redes sociais</h2>
          <ul className="mt-3 flex gap-2">
            {SOCIAL.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-8 place-items-center rounded-sm border border-primary text-primary hover:bg-primary/10"
                  aria-label={`${label} (abre em nova aba)`}
                >
                  <Icon className="size-4" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-lg font-bold">Carteiras compatíveis</h2>
          <WalletBadges className="mt-3" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
      {import.meta.env.VITE_SHOW_MOCK_PANEL !== 'false' && (
        <p className="mt-2 text-center">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('kurio:open-mock-panel'))}
            className="text-xs text-subtle underline underline-offset-2 hover:text-primary-strong"
            data-testid="open-mock-panel"
          >
            Painel de simulação (mocks)
          </button>
        </p>
      )}
    </footer>
  )
}
