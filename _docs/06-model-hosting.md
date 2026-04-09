# Model Hosting and Free Infrastructure

## Does V1 Work Without the LLM?

Yes, completely. The regex layer alone handles everything that matters
in a tax document.

W-2s, 1099s, and bank statements are structured forms. PII appears
in labeled fields, not narrative prose:

```
Employee's name:        John Martinez        ← labeled field
Social security number: 412-67-9823          ← labeled field
Employee's address:     441 Birchwood Lane   ← labeled field
```

Regex catches the SSN, the address pattern, and everything else in
labeled fields without needing to understand language. The NER model
only becomes necessary when PII appears in flowing prose with no
labels — which does not happen in a tax document.

The only real gap in V1 without the model: if a name appears
somewhere unstructured, regex won't catch it. Be honest about this
in the UI:

```
⚠ Name detection is limited without AI mode.
  Review the document for any names before downloading.
```

That is an honest, shippable V1. The tool still catches everything
dangerous — SSNs, account numbers, credit cards — which are the
items that actually enable identity theft.

---

## Can the Model Be Hosted Free on GitHub?

Not inference. GitHub Pages is a static file host — it cannot run
a model. GitHub Actions has compute but it is for build pipelines,
not serving requests.

GitHub can technically host the model file via Git LFS (Large File
Storage), but the free tier gives you 1GB storage and 1GB bandwidth
per month. A single model file is ~45-80MB. Multiple users downloading
it would exhaust that bandwidth quickly.

Do not use GitHub for model file hosting.

---

## Free Hosting Options for the ONNX Model

### Option 1 — Hugging Face Hub (Recommended)

Hugging Face hosts model files for free with no bandwidth limits.
This is exactly what the platform is designed for.

```
Upload ONNX model to Hugging Face Hub
        ↓
Reference via direct URL in app code
        ↓
Transformers.js downloads from Hugging Face on first use
        ↓
Service Worker caches it in user's browser permanently
        ↓
Never downloaded again on that device
```

App code:
```typescript
// src/workers/ner.worker.ts
import { pipeline } from '@xenova/transformers'

const MODEL_URL = 'your-username/your-pii-model'
// Transformers.js resolves this against huggingface.co automatically
// Or use full URL:
// 'https://huggingface.co/your-username/your-pii-model/resolve/main/'

const pipe = await pipeline('token-classification', MODEL_URL)
```

Hugging Face has free unlimited hosting for open model weights.
Bandwidth is shared infrastructure — no cost to you. This is how
most browser-based ML apps serve their models. Transformers.js is
built to load from Hugging Face URLs by default.

Having your model on Hugging Face is also a portfolio signal —
it makes the project discoverable to the ML community.

**Steps to publish:**
1. Create account at huggingface.co
2. Create a new model repository (public, MIT license)
3. Upload the quantized ONNX model file
4. Upload a model card (README.md) describing what it detects
5. Point Transformers.js at the repo

---

### Option 2 — Cloudflare R2

Cloudflare R2 is object storage with zero egress fees — you pay
nothing for downloads, ever. Free tier: 10GB storage, unlimited
egress.

```
Upload model file to R2 bucket once
        ↓
Enable public access on the bucket
        ↓
Serve via your Cloudflare domain
        ↓
Global Cloudflare network delivers it fast
```

```typescript
const MODEL_URL = 'https://models.yourdomain.app/pii-model-quantized.onnx'
```

Slightly more setup than Hugging Face but more control. Good choice
if you want to serve the model from your own domain.

**When to use R2 over Hugging Face:**
- You want the model served from your own domain
- You want full control over versioning and access
- You are serving a fine-tuned model you want to keep private

---

### Option 3 — jsDelivr (Fallback Only)

jsDelivr serves files from GitHub releases via a free global CDN.
Works for files under ~50MB. DistilBERT quantized is close to that
limit. Avoid as a primary — use as a fallback only.

```
https://cdn.jsdelivr.net/gh/yourname/yourrepo@v1.1.0/models/model.onnx
```

---

## Recommended Infrastructure Stack (Full Picture)

```
Domain             Porkbun               ~$12/year
App hosting        GitHub Pages          free
Build + deploy     GitHub Actions        free
CDN + DNS          Cloudflare (free)     free
Model hosting      Hugging Face Hub      free
Model CDN cache    Cloudflare            free (sits in front of HF)

Total cost         $12/year
```

---

## How Model Loading Works End to End

```
First visit (user has never used the app):

  User clicks "Enable name detection"
          ↓
  App checks Service Worker cache
  Cache miss — not downloaded yet
          ↓
  Download progress bar appears:
  "Downloading privacy engine (45MB) — this happens once"
          ↓
  Fetch from Hugging Face (or R2)
  Cloudflare caches at edge on first fetch
          ↓
  Service Worker intercepts response
  Stores model in Cache Storage on device
          ↓
  Web Worker initializes with cached model
  NER detection runs on current document
          ↓
  Preview screen updates with new highlights

Second visit (model already cached):

  User clicks "Enable name detection"
          ↓
  Service Worker cache hit — instant load
  No network request to Hugging Face
  Web Worker initializes immediately
          ↓
  NER detection runs
```

The user downloads the model exactly once per device, regardless
of how many documents they process. The Cloudflare cache means
the download is fast for any user in the world after the first
global fetch.

---

## Service Worker Caching Strategy for the Model

```typescript
// In your Workbox Service Worker config

import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// Cache the ONNX model with a Cache First strategy
// Once cached, never hit the network again for this file
registerRoute(
  ({ url }) =>
    url.hostname === 'huggingface.co' ||
    url.pathname.endsWith('.onnx'),
  new CacheFirst({
    cacheName: 'pii-model-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
    ],
  })
)
```

Version the cache name when you update the model:
`'pii-model-cache-v1'` → `'pii-model-cache-v2'`

Old cache is automatically cleaned up by Workbox on the next
Service Worker activation.

---

## CORS Requirements

Hugging Face serves model files with permissive CORS headers —
browsers can fetch from Hugging Face without CORS issues.

If you use Cloudflare R2, configure the bucket CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.app"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

---

## Model Versioning Strategy

Name model files with version suffixes:

```
pii-model-v1.0-quantized.onnx       initial release, ab-ai/pii_model
pii-model-v2.0-quantized.onnx       fine-tuned on tax documents
```

Reference the specific version in your app code. When you update
the model, bump the version in the URL and the Service Worker cache
name. Users get the new model on their next visit automatically.

---

## V1.1 Implementation Checklist

When you are ready to add the model in V1.1:

- [ ] Create Hugging Face account
- [ ] Convert ab-ai/pii_model to ONNX (see fine-tuning doc)
- [ ] Run dynamic quantization to reduce to ~45-80MB
- [ ] Upload to Hugging Face Hub with model card
- [ ] Add `@xenova/transformers` to package.json
- [ ] Create `src/workers/ner.worker.ts`
- [ ] Add model download progress UI to preview screen
- [ ] Configure Service Worker to cache model files
- [ ] Configure Vite for Web Worker bundling
- [ ] Update merge logic to handle NER + regex overlap
- [ ] Test that NER does not double-detect what regex already caught
- [ ] Verify model cache persists across sessions
- [ ] Test on slow connection (throttle in DevTools)
- [ ] Verify zero network requests after model is cached
