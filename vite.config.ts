import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

/**
 * In dev mode, Vite injects inline scripts for HMR and module loading.
 * The strict production CSP (`script-src 'self'`) would block those.
 * This plugin relaxes the CSP during development only.
 *
 * Key design: only relax what's strictly needed for HMR:
 * - script-src adds 'unsafe-inline' and 'unsafe-eval' for Vite's module loading
 * - connect-src changes from 'none' to 'ws: http://localhost:*' for HMR websocket
 * All other directives remain unchanged from the production CSP.
 */
function devCspPlugin(): Plugin {
  return {
    name: 'dev-csp-relaxer',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.server) {
          // Dev mode: relax CSP minimally for Vite HMR
          // - script-src: add 'unsafe-inline' 'unsafe-eval' for Vite module loading
          // - connect-src: change 'none' → 'ws: http://localhost:*' for HMR websocket only
          // All other directives (object-src, base-uri, frame-ancestors, etc.) stay strict
          return html.replace(
            /content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; worker-src 'self' blob:"/,
            `content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src ws: http://localhost:*; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; worker-src 'self' blob:"`
          )
        }
        return html
      },
    },
  }
}

/**
 * Copy pdfjs-dist worker to public/ so it is served as a raw static file
 * without Vite transforms. This guarantees the worker loads in Safari,
 * which has limited support for `new Worker(url, { type: "module" })` and
 * breaks when Vite injects HMR code into the served module.
 */
function copyPdfjsWorker(): Plugin {
  return {
    name: 'copy-pdfjs-worker',
    buildStart() {
      const src = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
      const destDir = resolve('public')
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
      copyFileSync(src, resolve(destDir, 'pdf.worker.min.mjs'))
    },
  }
}

export default defineConfig({
  plugins: [copyPdfjsWorker(), devCspPlugin(), preact()],
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
