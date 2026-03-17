import { Hono } from "hono";
import { cors } from "hono/cors";
import { connect } from "framer-api";

type Bindings = {
  CMS_KV: KVNamespace;
  FRAMER_API_KEY: string;
  FRAMER_PROJECT_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// GET /agents — read from KV
app.get("/agents", async (c) => {
  const data = await c.env.CMS_KV.get("agents", "json");
  if (!data) {
    return c.json({ error: "No data synced yet" }, 404);
  }
  return c.json({ agents: data });
});

// GET /agents/:slug — read from KV
app.get("/agents/:slug", async (c) => {
  const slug = c.req.param("slug");
  const data = await c.env.CMS_KV.get(`agent:${slug}`, "json");
  if (!data) {
    return c.json({ error: `Agent "${slug}" not found` }, 404);
  }
  return c.json(data);
});

// POST /sync — manual trigger
app.post("/sync", async (c) => {
  const result = await sync(c.env);
  return c.json(result);
});

// --- Sync logic ---

async function extractSvg(moduleUrl: string): Promise<string | null> {
  try {
    // First fetch the wrapper module to get the real URL
    let js = await (await fetch(moduleUrl)).text();
    const realUrlMatch = js.match(/from\s+"(https:\/\/framerusercontent\.com\/[^"]+)"/);
    if (realUrlMatch) {
      js = await (await fetch(realUrlMatch[1])).text();
    }
    // Pattern 1: src:'data:image/svg+xml,...'
    const dataMatch = js.match(/src:'(data:image\/svg\+xml,[^']+)'/);
    if (dataMatch) {
      return decodeURIComponent(dataMatch[1].replace("data:image/svg+xml,", ""));
    }
    // Pattern 2: const svg='<svg...'
    const svgMatch = js.match(/const svg='(<svg[^']+)'/);
    if (svgMatch) {
      return svgMatch[1];
    }
  } catch {}
  return null;
}

function flatten(
  item: { id: string; slug: string; fieldData: Record<string, unknown> },
  fieldMap: Record<string, string>
) {
  const result: Record<string, unknown> = { id: item.id, slug: item.slug };

  for (const [id, raw] of Object.entries(item.fieldData)) {
    const name = fieldMap[id] || id;
    const key = name.toLowerCase().replace(/\s+/g, "_");

    if (raw && typeof raw === "object" && "value" in raw) {
      const typed = raw as { type: string; value: unknown; valueByLocale?: Record<string, unknown> };
      result[key] = typed.value;

      if (typed.valueByLocale) {
        const locale = Object.values(typed.valueByLocale).find(
          (l: any) => l.status === "done" && l.value
        ) as { value: string } | undefined;
        if (locale) {
          result[`${key}_ar`] = locale.value;
        }
      }
    } else {
      result[key] = raw;
    }
  }

  return result;
}

async function sync(env: Bindings) {
  const framer = await connect(env.FRAMER_PROJECT_URL, env.FRAMER_API_KEY);

  try {
    const collections = await framer.getCollections();
    const agentsCol = collections.find((c) => c.name.toLowerCase() === "agents");
    if (!agentsCol) throw new Error("Agents collection not found");

    const fields = await agentsCol.getFields();
    const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f.name]));

    const items = await agentsCol.getItems();
    const agents = items.filter((item) => !item.draft).map((item) => flatten(item, fieldMap));

    // Extract SVGs from icon URLs
    for (const agent of agents) {
      const iconUrl = agent.icon as string | undefined;
      if (iconUrl && typeof iconUrl === "string" && iconUrl.includes("framer")) {
        const svg = await extractSvg(iconUrl);
        if (svg) {
          agent.icon_svg = svg;
        }
      }
    }

    // Write to KV
    await env.CMS_KV.put("agents", JSON.stringify(agents));
    for (const agent of agents) {
      await env.CMS_KV.put(`agent:${agent.slug}`, JSON.stringify(agent));
    }

    const syncedAt = new Date().toISOString();
    await env.CMS_KV.put("meta", JSON.stringify({ syncedAt, count: agents.length }));

    return { ok: true, syncedAt, count: agents.length };
  } finally {
    await framer.disconnect();
  }
}

// --- Export ---

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(sync(env));
  },
};
