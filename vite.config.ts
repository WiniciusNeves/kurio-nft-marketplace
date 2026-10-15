import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * O app só pode ser *avaliado* depois que o MSW substitui o WebSocket (ver src/main.tsx),
 * mas pode ser *baixado* em paralelo. Este plugin injeta <link rel="modulepreload"> para o
 * chunk do App e suas dependências, eliminando uma cadeia de requisições no carregamento.
 */
function preloadAppChunk(): Plugin {
  return {
    name: 'kurio:preload-app-chunk',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        // `browser` = camada de mocks (MSW); `App` = aplicação.
        const roots = Object.values(bundle).filter(
          (c) => c.type === 'chunk' && (c.name === 'App' || c.name === 'browser'),
        )
        if (!roots.length) return html
        const files = new Set<string>(roots.map((r) => r.fileName))
        const walk = (name: string) => {
          const c = bundle[name]
          if (c?.type === 'chunk')
            c.imports.forEach((i) => {
              if (!files.has(i)) {
                files.add(i)
                walk(i)
              }
            })
        }
        roots.forEach((r) => walk(r.fileName))
        const links = [...files]
          .filter((f) => !html.includes(`/${f}"`))
          .map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`)
          .join('\n    ')
        return html.replace('</head>', `  ${links}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadAppChunk()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
