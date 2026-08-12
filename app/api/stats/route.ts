import { env } from "cloudflare:workers";

async function ensureTable() {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS site_stats (key TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL DEFAULT 0)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO site_stats (key, value) VALUES ('views', 0), ('calculations', 0)").run();
}

async function readStats() {
  const rows = await env.DB.prepare("SELECT key, value FROM site_stats WHERE key IN ('views', 'calculations')").all<{ key: string; value: number }>();
  const stats = { views: 0, calculations: 0 };
  for (const row of rows.results) {
    if (row.key === "views") stats.views = row.value;
    if (row.key === "calculations") stats.calculations = row.value;
  }
  return stats;
}

export async function GET(request: Request) {
  await ensureTable();
  if (new URL(request.url).searchParams.get("track") === "view") {
    await env.DB.prepare("UPDATE site_stats SET value = value + 1 WHERE key = 'views'").run();
  }
  return Response.json(await readStats(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await ensureTable();
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action !== "calculate") return Response.json({ error: "Invalid action" }, { status: 400 });
  await env.DB.prepare("UPDATE site_stats SET value = value + 1 WHERE key = 'calculations'").run();
  return Response.json(await readStats(), { headers: { "Cache-Control": "no-store" } });
}
