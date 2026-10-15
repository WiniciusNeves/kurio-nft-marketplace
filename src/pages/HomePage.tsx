import { useCallback } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CatalogSection, type SetSearch } from '@/features/catalog/CatalogSection'
import type { CatalogSearch } from '@/features/catalog/searchSchema'

function useCatalogUrlState(from: '/' | '/mercado') {
  const search = useSearch({ from }) as CatalogSearch
  const navigate = useNavigate({ from })
  const setSearch: SetSearch = useCallback(
    (patch, opts) =>
      void navigate({
        search: (prev: CatalogSearch) => ({ ...prev, ...patch, ...(opts?.resetPage ? { page: undefined } : {}) }),
        // Busca digitada substitui a entrada do histórico; filtros/paginação criam novas entradas.
        replace: Object.keys(patch).length === 1 && 'q' in patch,
        resetScroll: false,
      }),
    [navigate],
  )
  return { search, setSearch }
}

export function HomePage() {
  const { search, setSearch } = useCatalogUrlState('/')
  return (
    <>
      <Hero />
      <div className="container-page mt-8 md:mt-24">
        <CatalogSection search={search} setSearch={setSearch} aside={<FeaturedCard />} />
      </div>
      <Promos />
      <Blog />
    </>
  )
}

export function MarketPage() {
  const { search, setSearch } = useCatalogUrlState('/mercado')
  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado' }]} />
      <h1 className="sr-only">Mercado de NFTs</h1>
      <CatalogSection search={search} setSearch={setSearch} />
    </div>
  )
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="container-page">
      {/* Desktop / tablet */}
      <div className="relative mt-3 hidden items-center gap-10 md:grid md:grid-cols-[1fr_minmax(280px,450px)]">
        <div className="px-0 lg:px-12">
          <p className="text-sm tracking-[0.1em]">Bem-vindo à Kurio</p>
          <h1
            id="hero-title"
            className="mt-4 text-3xl leading-[1.6] font-bold uppercase lg:text-[43px] lg:leading-[70px]"
          >
            Seja dono do futuro
            <br />
            da arte digital
          </h1>
          <p className="mt-3 max-w-[460px] text-sm leading-6 text-muted">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie
            artistas e tenha uma parte da cultura da internet.
          </p>
          <Link
            to="/mercado"
            className="mt-12 inline-flex h-10 items-center rounded-sm bg-primary px-7 text-[15px] font-bold text-primary-foreground uppercase hover:bg-primary-strong"
          >
            Explorar
          </Link>
        </div>
        <img
          src="/nfts/emerald-ape.webp"
          alt="Emerald Ape #042: macaco de pelo castanho com óculos redondos verdes e jaqueta college verde"
          width={450}
          height={450}
          fetchPriority="high"
          className="aspect-square w-full rounded-[16px] object-cover"
        />
      </div>

      {/* Mobile (Figma: Mobile / Início › Hero Banner) */}
      <div className="relative mt-4 overflow-hidden rounded-[24px] bg-surface p-4 md:hidden">
        <div aria-hidden className="pointer-events-none absolute top-0 -left-10 size-72 rounded-full bg-band/60" />
        <div className="relative grid grid-cols-[1fr_auto] gap-3">
          <div>
            <p className="text-xs font-bold">Bem-vindo à Kurio</p>
            <p className="mt-3 text-lg leading-snug font-bold uppercase" aria-hidden>
              Seja dono da cultura digital
            </p>
            <h1 className="sr-only">Seja dono do futuro da arte digital</h1>
            <p className="mt-2 text-xs leading-5 text-muted">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <Link
              to="/mercado"
              className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-primary-strong uppercase"
            >
              Explorar <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="relative w-[138px]">
            <img
              src="/nfts/emerald-ape.webp"
              alt=""
              width={138}
              height={138}
              fetchPriority="high"
              className="aspect-square w-full rounded-xl object-cover"
            />
            <img
              src="/nfts/violet-nomad-thumb.webp"
              alt=""
              width={58}
              height={58}
              className="absolute -bottom-2 left-1 size-[58px] rounded-xl border-2 border-surface object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function FeaturedCard() {
  return (
    <aside aria-labelledby="destaque" className="mt-6 hidden lg:block">
      <div className="bg-surface pt-6">
        <h2 id="destaque" className="px-3 text-2xl font-bold text-primary-strong uppercase">
          NFT em destaque
        </h2>
        <p className="mt-2 px-8 text-lg font-bold uppercase">Oferta limitada</p>
        <Link
          to="/nft/$nftId"
          params={{ nftId: 'cosmic-bloom-118' }}
          className="mt-4 block"
          aria-label="Ver Cosmic Bloom #118 — oferta limitada"
        >
          <img
            src="/nfts/violet-nomad.webp"
            alt="Cosmic Bloom #118: gorila com chapéu bucket e moletom roxo"
            width={310}
            height={368}
            loading="lazy"
            className="h-[368px] w-full rounded-[16px] object-cover"
          />
        </Link>
      </div>
    </aside>
  )
}

function Promos() {
  const promos = [
    {
      title: 'Lançamentos gênesis de edição limitada',
      text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      img: '/nfts/emerald-ape.webp',
      search: { tab: 'new' as const },
    },
    {
      title: 'Arte digital selecionada e muito mais',
      text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
      img: '/nfts/ivory-baron.webp',
      search: { category: ['arte-digital' as const] },
    },
  ]
  return (
    <section aria-label="Destaques" className="container-page mt-24 grid gap-6 md:grid-cols-2 lg:gap-8">
      {promos.map((p) => (
        <article key={p.title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] overflow-hidden bg-surface">
          <img
            src={p.img}
            alt=""
            width={287}
            height={250}
            loading="lazy"
            className="h-full min-h-48 w-full object-cover"
          />
          <div className="flex flex-col items-end justify-center gap-3 p-4 text-right md:p-6">
            <h2 className="text-sm font-bold md:text-lg">{p.title}</h2>
            <p className="text-xs leading-5 text-muted md:text-sm">{p.text}</p>
            <Link
              to="/mercado"
              search={p.search}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-strong"
            >
              Explorar <ArrowRight className="size-4" aria-hidden />
              <span className="sr-only">: {p.title}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  {
    date: '12 de setembro',
    read: 6,
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    img: '/nfts/ivory-baron.webp',
  },
  {
    date: '13 de setembro',
    read: 2,
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
    img: '/nfts/emerald-ape.webp',
  },
  {
    date: '15 de setembro',
    read: 3,
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    img: '/nfts/violet-nomad.webp',
  },
  {
    date: '15 de setembro',
    read: 2,
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
    img: '/nfts/golden-beat.webp',
  },
]

function Blog() {
  return (
    <section aria-labelledby="blog" className="container-page mt-24">
      <h2 id="blog" className="text-center text-2xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-sm text-muted">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title}>
            <article className="flex h-full flex-col bg-surface">
              <img
                src={p.img}
                alt=""
                width={268}
                height={196}
                loading="lazy"
                className="h-[196px] w-full object-cover"
              />
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs text-muted">
                  {p.date} <span aria-hidden>|</span> Leitura de {p.read} min
                </p>
                <h3 className="mt-3 text-base leading-snug font-bold">{p.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted">{p.text}</p>
                <Link
                  to="/em-breve"
                  search={{ secao: 'diario' }}
                  className="mt-auto pt-3 text-xs font-bold text-primary-strong"
                >
                  Ler mais <span aria-hidden>→</span>
                  <span className="sr-only">: {p.title}</span>
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
