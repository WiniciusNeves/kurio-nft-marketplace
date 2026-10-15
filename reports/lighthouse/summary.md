# Lighthouse — mediana de 3 execuções

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| inicio | mobile | 76 | 100 | 100 | 100 | 4067 ms | 0 | 451 ms |
| detalhe | mobile | 77 | 99 | 100 | 100 | 3994 ms | 0 | 221 ms |
| inicio | desktop | 100 | 100 | 100 | 100 | 664 ms | 0 | 16 ms |
| detalhe | desktop | 99 | 100 | 100 | 100 | 909 ms | 0 | 0 ms |

## Ambiente

- **date**: 2026-10-14T22:52:50.408Z
- **node**: v22.22.0
- **os**: Linux 6.18.44-fc-v114 x64
- **cpus**: 2
- **lighthouse**: 12.8.2
- **chrome**: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36
- **baseUrl**: http://localhost:4173
- **runsPerPage**: 3
- **conditions**: Build otimizado (vite build, mocks ativos) servido por vite preview; MSW + Socket.IO simulados ativos (cenário padrão); throttling padrão do Lighthouse (mobile: 4x CPU + Slow 4G simulado; desktop: preset desktop).
