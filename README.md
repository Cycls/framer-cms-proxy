# Framer CMS Proxy

Cloudflare Worker that serves the cycls.ai Framer CMS **Agents** collection as a public REST API.

Data is synced hourly from Framer to Cloudflare KV for instant responses.

**Live:** https://cms.cycls.ai

## Endpoints

| Method | Path             | Description              |
| ------ | ---------------- | ------------------------ |
| GET    | `/agents`        | List all agents          |
| GET    | `/agents/:slug`  | Get agent by slug        |
| POST   | `/sync`          | Trigger manual CMS sync  |

## Response shape

```json
{
  "id": "f7G8U77EM",
  "slug": "haseef",
  "title": "Haseef",
  "title_ar": "حصيف",
  "categories": ["legal"],
  "tags": ["legal", "saudi-law", "research"],
  "tag1": "legal",
  "tag2": "saudi-law",
  "tag3": "research",
  "description": "Specialized legal assistant for...",
  "description_ar": "مساعد قانوني متخصص...",
  "link": "https://haseef.cycls.ai/",
  "icon": "https://framer.com/m/Haseef-1plJjA.js",
  "icon_svg": "<svg ...>...</svg>"
}
```

## How it works

1. **Cron trigger** (every hour) connects to Framer Server API via WebSocket
2. Fetches the Agents collection, flattens fields to human-readable keys
3. Extracts inline SVG icons from Framer module URLs
4. Stores everything in Cloudflare KV
5. `GET` requests read directly from KV (~2ms response time)

## Setup

```bash
npm install
```

Create `.dev.vars` for local development:

```
FRAMER_API_KEY=your-framer-api-key
```

## Development

```bash
npm run dev
# Then trigger sync: curl -X POST http://localhost:8787/sync
```

## Deploy

```bash
npx wrangler secret put FRAMER_API_KEY
npm run deploy
# Trigger initial sync: curl -X POST https://cms.cycls.ai/sync
```

## Stack

- [Hono](https://hono.dev) — web framework
- [Framer Server API](https://www.framer.com/developers/server-api-introduction) — CMS data source
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — runtime
- [Cloudflare KV](https://developers.cloudflare.com/kv/) — data store
