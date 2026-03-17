import { Hono } from "hono";
import { cors } from "hono/cors";
import { connect, type Framer } from "framer-api";

type Bindings = {
  FRAMER_API_KEY: string;
  FRAMER_PROJECT_URL: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: { framer: Framer } }>();

app.use("*", cors());

// Middleware: connect to Framer per-request
app.use("/agents/*", async (c, next) => {
  try {
    const framer = await connect(c.env.FRAMER_PROJECT_URL, c.env.FRAMER_API_KEY);
    c.set("framer", framer);
    try {
      await next();
    } finally {
      await framer.disconnect();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// GET /agents
app.get("/agents", async (c) => {
  const collections = await c.var.framer.getCollections();
  const agents = collections.find(
    (col) => col.name.toLowerCase() === "agents"
  );

  if (!agents) {
    return c.json({ error: "Agents collection not found" }, 404);
  }

  const fields = await agents.getFields();
  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f.name]));

  const items = await agents.getItems();

  return c.json({
    agents: items
      .filter((item) => !item.draft)
      .map((item) => ({
        id: item.id,
        slug: item.slug,
        ...mapFields(item.fieldData, fieldMap),
      })),
  });
});

// GET /agents/:slug
app.get("/agents/:slug", async (c) => {
  const slug = c.req.param("slug");

  const collections = await c.var.framer.getCollections();
  const agents = collections.find(
    (col) => col.name.toLowerCase() === "agents"
  );

  if (!agents) {
    return c.json({ error: "Agents collection not found" }, 404);
  }

  const fields = await agents.getFields();
  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f.name]));

  const items = await agents.getItems();
  const item = items.find((i) => i.slug === slug);

  if (!item) {
    return c.json({ error: `Agent "${slug}" not found` }, 404);
  }

  return c.json({
    id: item.id,
    slug: item.slug,
    ...mapFields(item.fieldData, fieldMap),
  });
});

function mapFields(
  fieldData: Record<string, unknown>,
  fieldMap: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(fieldData)) {
    const name = fieldMap[id] || id;
    result[name] = value;
  }
  return result;
}

export default app;
