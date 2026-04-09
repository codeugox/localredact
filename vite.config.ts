import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'

/**
 * In dev mode, Vite injects inline scripts for HMR and module loading.
 * The strict production CSP (`script-src 'self'`) would block those.
 * This plugin relaxes the CSP during development only.
 */
function devCspPlugin(): Plugin {
  return {
    name: 'dev-csp-relaxer',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.server) {
          // Dev mode: relax CSP for Vite HMR inline scripts and WebSocket
          return html.replace(
            /content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; worker-src 'self' blob:"/,
            `content="default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; connect-src ws://localhost:* http://localhost:*; worker-src 'self' blob:"`
          )
        }
        return html
      },
    },
  }
}

export default defineConfig({
  plugins: [devCspPlugin(), preact()],
  base: './',
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          jspdf: ['jspdf'],
        },
      },
    },
  },
})
