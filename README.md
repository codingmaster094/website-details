# Website Intelligence Analyzer

Production-ready Next.js app that takes company website URLs, crawls public pages on the server, detects technologies deterministically, analyzes the collected content with **Google Gemini**, validates the structured JSON schema, and displays / exports accurate company intelligence.

The crawler collects website evidence first, then Google Gemini analyzes that payload with strict accuracy guidelines.

## Features & Accurate Data Extraction

- **Company Name**: Official legal or brand name extracted from the website.
- **Owner / Founder**: Strictly verified (Founder, Co-Founder, CEO, Managing Director, Proprietor). Random employees are never picked.
- **Company Email**: Official public domain contact email (e.g. info@, contact@, hello@, sales@). Never hallucinated.
- **Company Phone**: Verified and sanitized international/local contact numbers.
- **Services**: Comprehensive extraction of all services and offerings from pages, navigation menus, and headings.
- **Technologies**: Deterministic detection (WordPress, Shopify, Next.js, React, Tailwind, Analytics, etc.) + AI confirmed stack.
- **Excel Export**: Export single or batch results directly to Excel (.xlsx).

## Setup & Google Gemini API Key

1. Copy `.env.example` to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

2. Add your **Google Gemini API Key** in `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Get your Gemini key from [Google AI Studio](https://aistudio.google.com/apikey).

Optional parameters:
```env
MAX_PAGES=10
FETCH_TIMEOUT_MS=15000
MAX_RESPONSE_BYTES=1500000
MAX_RETRIES=2
```

3. Run locally:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Single Website:** Enter `https://example.com` and click **Analyze Website**.
- **Website List:** Paste one URL per line and click **Analyze Website List**.

## Vercel Deployment

1. Framework Preset: **Next.js**
2. Build Command: `npm run build`
3. Environment Variable:
   - `GEMINI_API_KEY` (Required)
   - `GEMINI_MODEL` = `gemini-2.5-flash` (Optional)

## Scripts

- `npm run dev` — development server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm start` — start production server
