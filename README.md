# Website Intelligence Analyzer

Production-ready Next.js app that takes a single company website URL, crawls a limited set of public pages on the server, detects technologies deterministically, analyzes the collected content with Gemini, validates the JSON with Zod, and displays / exports the result.

Gemini never browses the website. The crawler collects evidence first, then Gemini analyzes that payload.

## Setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

2. Set `GEMINI_API_KEY` in `.env.local`. Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

Optional:

```
GEMINI_MODEL=gemini-2.5-flash
MAX_PAGES=10
FETCH_TIMEOUT_MS=15000
MAX_RESPONSE_BYTES=1500000
MAX_RETRIES=2
```

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a public company URL, and click **Analyze Website**.

## Scripts

- `npm run dev` — development server
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm start` — start production server

## API

`POST /api/analyze`

```json
{ "url": "https://example.com" }
```

Success:

```json
{ "success": true, "data": { } }
```

Excel export: `POST /api/export/excel` with the analysis object. The UI also provides Copy JSON, Download JSON, and Download Excel (`website-analysis-YYYY-MM-DD.xlsx`).

## Security

- Only `http://` and `https://`
- SSRF blocking for localhost, private IPs, internal hostnames, and unsafe protocols
- Redirects must stay on the same registrable domain
- Timeouts, retries, response size limits, crawl page cap, and IP rate limiting
- `GEMINI_API_KEY` is server-only
