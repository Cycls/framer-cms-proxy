# Framer CMS Proxy

Cloudflare Worker that proxies the cycls.ai Framer CMS Agents collection as a public REST API.

Built with [Hono](https://hono.dev) + [Framer Server API](https://www.framer.com/developers/server-api-introduction).

## Endpoints

| Method | Path             | Description          |
| ------ | ---------------- | -------------------- |
| GET    | `/agents`        | List all agents      |
| GET    | `/agents/:slug`  | Get agent by slug    |

## Setup

```bash
npm install
```

Create `.dev.vars` for local secrets:

```
FRAMER_API_KEY=your-framer-api-key
```

## Development

```bash
npm run dev
```

Runs locally at `http://localhost:8787`.

## Deploy

```bash
npx wrangler secret put FRAMER_API_KEY
npm run deploy
```

## How it works

Each request opens a WebSocket connection to Framer's Server API, fetches the Agents collection, maps field IDs to human-readable names, and returns JSON. The connection is closed after each request.
