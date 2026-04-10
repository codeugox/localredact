// src/browser-check.ts
// Early browser compatibility check. Imported before Preact renders so we can
// show an "unsupported browser" message by manipulating the DOM directly.
// Moved out of an inline <script> in index.html to comply with the strict
// CSP (`script-src 'self'`) which blocks inline scripts in production builds.

if (!window.Worker || !window.File || !window.Promise) {
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML =
      '<div style="text-align:center;padding:60px 20px;font-family:system-ui">' +
      '<h1>Browser Not Supported</h1>' +
      '<p>Local Redact requires a modern browser with Web Worker support.</p>' +
      '<p>Please use Chrome 118+, Firefox 115+, Safari 16.4+, or Edge 118+.</p></div>'
  }
}
