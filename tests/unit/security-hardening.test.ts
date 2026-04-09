// tests/unit/security-hardening.test.ts
// Verify security hardening: CSP meta tag, no storage API usage, no external resources.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = join(__dirname, '..', '..')
const SRC = join(ROOT, 'src')
const INDEX_HTML = join(ROOT, 'index.html')

/**
 * Recursively collect all files in a directory with given extensions.
 */
function collectFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectFiles(full, extensions))
    } else if (extensions.includes(extname(full))) {
      files.push(full)
    }
  }
  return files
}

describe('Security Hardening — CSP Meta Tag', () => {
  const html = readFileSync(INDEX_HTML, 'utf-8')

  it('should contain a Content-Security-Policy meta tag', () => {
    expect(html).toContain('http-equiv="Content-Security-Policy"')
  })

  it('should set default-src to self only', () => {
    expect(html).toMatch(/default-src\s+'self'/)
  })

  it('should set script-src to self only', () => {
    expect(html).toMatch(/script-src\s+'self'/)
  })

  it('should set style-src to self and unsafe-inline', () => {
    expect(html).toMatch(/style-src\s+'self'\s+'unsafe-inline'/)
  })

  it('should set img-src to self, blob, and data', () => {
    expect(html).toMatch(/img-src\s+'self'\s+blob:\s+data:/)
  })

  it("should set connect-src to 'none'", () => {
    expect(html).toMatch(/connect-src\s+'none'/)
  })

  it("should set object-src to 'none'", () => {
    expect(html).toMatch(/object-src\s+'none'/)
  })

  it("should set base-uri to 'none'", () => {
    expect(html).toMatch(/base-uri\s+'none'/)
  })

  it("should set frame-ancestors to 'none'", () => {
    expect(html).toMatch(/frame-ancestors\s+'none'/)
  })

  it("should set worker-src to include 'self'", () => {
    expect(html).toMatch(/worker-src\s+'self'/)
  })
})

describe('Security Hardening — Additional Security Meta Tags', () => {
  const html = readFileSync(INDEX_HTML, 'utf-8')

  it('should set X-Content-Type-Options to nosniff', () => {
    expect(html).toContain('http-equiv="X-Content-Type-Options"')
    expect(html).toContain('content="nosniff"')
  })

  it('should set X-Frame-Options to DENY', () => {
    expect(html).toContain('http-equiv="X-Frame-Options"')
    expect(html).toContain('content="DENY"')
  })

  it('should set Referrer-Policy to no-referrer', () => {
    expect(html).toContain('name="referrer"')
    expect(html).toContain('content="no-referrer"')
  })

  it('should set Permissions-Policy to restrict capabilities', () => {
    expect(html).toContain('Permissions-Policy')
    expect(html).toMatch(/camera=\(\)/)
    expect(html).toMatch(/microphone=\(\)/)
    expect(html).toMatch(/geolocation=\(\)/)
  })
})

describe('Security Hardening — No Storage API Usage', () => {
  const srcFiles = collectFiles(SRC, ['.ts', '.tsx', '.js', '.jsx'])

  it('should not use localStorage in any source file', () => {
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `Found localStorage in ${file}`).not.toMatch(
        /\blocalStorage\b/
      )
    }
  })

  it('should not use sessionStorage in any source file', () => {
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `Found sessionStorage in ${file}`).not.toMatch(
        /\bsessionStorage\b/
      )
    }
  })

  it('should not use IndexedDB in any source file', () => {
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `Found IndexedDB/indexedDB in ${file}`).not.toMatch(
        /\b[Ii]ndexedDB\b/
      )
    }
  })
})

describe('Security Hardening — No External Resources', () => {
  const srcFiles = collectFiles(SRC, ['.ts', '.tsx', '.js', '.jsx', '.css'])

  it('should not load external fonts (@font-face)', () => {
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(content, `Found @font-face in ${file}`).not.toMatch(
        /@font-face/
      )
    }
  })

  it('should not reference Google Fonts', () => {
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(
        content,
        `Found Google Fonts reference in ${file}`
      ).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
    }
  })

  it('should not use fetch() in application code', () => {
    for (const file of srcFiles) {
      // Skip CSS files
      if (file.endsWith('.css')) continue
      const content = readFileSync(file, 'utf-8')
      expect(content, `Found fetch() in ${file}`).not.toMatch(/\bfetch\s*\(/)
    }
  })

  it('should not use XMLHttpRequest in application code', () => {
    for (const file of srcFiles) {
      if (file.endsWith('.css')) continue
      const content = readFileSync(file, 'utf-8')
      expect(content, `Found XMLHttpRequest in ${file}`).not.toMatch(
        /\bXMLHttpRequest\b/
      )
    }
  })

  it('should have no third-party script tags in index.html', () => {
    const html = readFileSync(INDEX_HTML, 'utf-8')
    const scriptTags = html.match(/<script[^>]*src="([^"]*)"[^>]*>/g) || []
    for (const tag of scriptTags) {
      // All script srcs should be local (start with / or ./)
      expect(tag, 'Found non-local script tag').toMatch(
        /src="(\/|\.\/)[^"]*"/
      )
    }
  })

  it('should not include analytics or tracking scripts', () => {
    const html = readFileSync(INDEX_HTML, 'utf-8')
    expect(html).not.toMatch(/google-analytics|gtag|analytics\.js/)
    expect(html).not.toMatch(/mixpanel|segment|sentry/)
    expect(html).not.toMatch(/facebook|fbq/)
  })
})

describe('Security Hardening — Vite Dev CSP Plugin', () => {
  it('dev CSP plugin should only relax connect-src, not remove other directives', async () => {
    // Read vite.config.ts to verify the dev CSP replacement pattern
    const viteConfig = readFileSync(join(ROOT, 'vite.config.ts'), 'utf-8')

    // The dev mode CSP replacement should still include all security directives
    expect(viteConfig).toContain("object-src 'none'")
    expect(viteConfig).toContain("base-uri 'none'")
    expect(viteConfig).toContain("frame-ancestors 'none'")

    // The dev replacement should add ws: for HMR but not wildcard everything
    expect(viteConfig).toContain('connect-src ws:')
    // Should NOT have the old overly-permissive default-src
    expect(viteConfig).not.toContain("default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:")
  })

  it('production CSP in index.html should have connect-src none', () => {
    const html = readFileSync(INDEX_HTML, 'utf-8')
    expect(html).toMatch(/connect-src\s+'none'/)
  })
})

describe('Security Hardening — Font Stack', () => {
  const cssFile = join(SRC, 'styles', 'app.css')
  const css = readFileSync(cssFile, 'utf-8')

  it('should define --font-ui as a system font stack', () => {
    expect(css).toMatch(/--font-ui:[\s\S]*?-apple-system/)
    expect(css).toMatch(/--font-ui:[\s\S]*?system-ui/)
  })

  it('should define --font-mono as a system monospace stack', () => {
    expect(css).toMatch(/--font-mono:[\s\S]*?ui-monospace/)
    expect(css).toMatch(/--font-mono:[\s\S]*?monospace/)
  })

  it('should only use var(--font-ui) or var(--font-mono) for font-family', () => {
    // Extract all font-family declarations from CSS
    const fontFamilyDecls = css.match(/font-family:\s*[^;]+/g) || []
    for (const decl of fontFamilyDecls) {
      expect(
        decl,
        `Non-variable font-family found: ${decl}`
      ).toMatch(/var\(--font-(ui|mono)\)/)
    }
  })
})
