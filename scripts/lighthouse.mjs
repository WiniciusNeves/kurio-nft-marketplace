/**
 * Auditoria Lighthouse versionada.
 *  - build otimizado de demonstração (mocks ativos, cenário padrão) servido por `vite preview`;
 *  - páginas: início e detalhe do NFT; perfis mobile (padrão do Lighthouse) e desktop;
 *  - 3 execuções por página/perfil, mediana por categoria + LCP, CLS e TBT;
 *  - relatórios HTML/JSON em reports/lighthouse/ e resumo em reports/lighthouse/summary.{json,md}.
 *
 * Uso: npm run build:demo && npm run lighthouse
 *      (o script sobe o preview sozinho se a porta 4173 estiver livre)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'

const BASE = process.env.LH_BASE_URL ?? 'http://localhost:4173'
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT = path.resolve('reports/lighthouse')
const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/emerald-ape-042' },
]
const PROFILES = [
  { name: 'mobile', config: undefined },
  { name: 'desktop', config: desktopConfig },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function ensureServer() {
  try {
    await fetch(BASE)
    return null
  } catch {
    const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true })
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250))
      try {
        await fetch(BASE)
        return proc
      } catch {
        /* aguardando */
      }
    }
    throw new Error('vite preview não iniciou')
  }
}

const server = await ensureServer()
await fs.mkdir(OUT, { recursive: true })
const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
const results = []

for (const profile of PROFILES) {
  for (const pg of PAGES) {
    const runs = []
    for (let i = 1; i <= RUNS; i++) {
      // Perfil limpo a cada execução (sem cache/IndexedDB/SW de execuções anteriores).
      const chrome = await chromeLauncher.launch({
        chromePath,
        chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
      })
      try {
        const url = `${BASE}${pg.path}`
        const r = await lighthouse(
          url,
          { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: CATEGORIES },
          profile.config,
        )
        const [html, json] = r.report
        const base = `${pg.name}-${profile.name}-${i}`
        await fs.writeFile(path.join(OUT, `${base}.html`), html)
        await fs.writeFile(path.join(OUT, `${base}.json`), json)
        const lhr = r.lhr
        runs.push({
          scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
          lcp: lhr.audits['largest-contentful-paint'].numericValue,
          cls: lhr.audits['cumulative-layout-shift'].numericValue,
          tbt: lhr.audits['total-blocking-time'].numericValue,
          lighthouseVersion: lhr.lighthouseVersion,
          userAgent: lhr.environment.hostUserAgent,
        })
        console.log(
          `${base}:`,
          runs.at(-1).scores,
          `LCP ${Math.round(runs.at(-1).lcp)}ms CLS ${runs.at(-1).cls.toFixed(3)} TBT ${Math.round(runs.at(-1).tbt)}ms`,
        )
      } finally {
        await chrome.kill()
      }
    }
    results.push({
      page: pg.name,
      profile: profile.name,
      median: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
      lcpMs: Math.round(median(runs.map((r) => r.lcp))),
      cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
      tbtMs: Math.round(median(runs.map((r) => r.tbt))),
      runs,
    })
  }
}

const env = {
  date: new Date().toISOString(),
  node: process.version,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  cpus: os.cpus().length,
  lighthouse: results[0]?.runs[0]?.lighthouseVersion,
  chrome: results[0]?.runs[0]?.userAgent,
  baseUrl: BASE,
  runsPerPage: RUNS,
  conditions:
    'Build otimizado (vite build, mocks ativos) servido por vite preview; MSW + Socket.IO simulados ativos (cenário padrão); throttling padrão do Lighthouse (mobile: 4x CPU + Slow 4G simulado; desktop: preset desktop).',
}
await fs.writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ env, results }, null, 2))

const header =
  '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |\n|---|---|---|---|---|---|---|---|---|'
const rows = results
  .map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median['best-practices']} | ${r.median.seo} | ${r.lcpMs} ms | ${r.cls} | ${r.tbtMs} ms |`,
  )
  .join('\n')
await fs.writeFile(
  path.join(OUT, 'summary.md'),
  `# Lighthouse — mediana de ${RUNS} execuções\n\n${header}\n${rows}\n\n## Ambiente\n\n${Object.entries(env)
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join('\n')}\n`,
)
console.log(`\n${header}\n${rows}`)
server?.kill()
process.exit(0)
