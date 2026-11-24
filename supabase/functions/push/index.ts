// Cuenta conmigo · avisos al celular (demo de sincronización entre dispositivos).
// POST {action:'sub', sala, sub}  → guarda la suscripción del celular
// POST {action:'send', sala, title, body, img?, k?, tag?, url?} → notifica a los celulares de la sala
import postgres from "npm:postgres@3.4.4";
import { send, type Vapid } from "./webpush.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
const V: Vapid = { publicKey: Deno.env.get("VAPID_PUBLIC")!, privateJwk: JSON.parse(Deno.env.get("VAPID_PRIVATE_JWK")!), subject: "https://rodolforjs.github.io/asistente-inicio-proto/" };
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });
// la tabla se crea sola la primera vez (misma definición que supabase/migrations)
let ready: Promise<unknown> | null = null;
const init = () => ready ??= sql.unsafe(`create table if not exists public.push_subs (endpoint text primary key, sala text not null, sub jsonb not null, ua text, created_at timestamptz not null default now());
  create index if not exists push_subs_sala on public.push_subs (sala, created_at desc);
  alter table public.push_subs enable row level security;`).catch((e) => { ready = null; throw e; });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "method" }, 405);
  let b: Record<string, any>; try { b = await req.json(); } catch { return j({ error: "json" }, 400); }
  const sala = clip(b.sala, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!sala) return j({ error: "sala" }, 400);
  try { await init(); } catch (e) { return j({ error: "db", detail: String(e) }, 500); }

  if (b.action === "sub") {
    const s = b.sub;
    if (!/^https:\/\//.test(s?.endpoint ?? "") || !s?.keys?.p256dh || !s?.keys?.auth) return j({ error: "sub" }, 400);
    const row = { endpoint: s.endpoint, sala, sub: sql.json({ endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } }), ua: clip(b.ua, 200) };
    await sql`insert into push_subs ${sql(row)} on conflict (endpoint) do update set sala = excluded.sala, sub = excluded.sub, ua = excluded.ua, created_at = now()`;
    return j({ ok: true });
  }

  if (b.action === "send") {
    const msg = { title: clip(b.title, 80), body: clip(b.body, 220), img: clip(b.img, 400), k: clip(b.k, 20), tag: clip(b.tag, 40) || "cc", url: clip(b.url, 300), gift: clip(b.gift, 80), price: clip(b.price, 30), para: clip(b.para, 40), ts: Date.now() };
    const data = await sql`select endpoint, sub from push_subs where sala = ${sala} order by created_at desc limit 12`;
    const out = await Promise.all(data.map(async (r) => {
      try {
        const res = await send(r.sub, msg, V);
        if (res.status === 404 || res.status === 410) await sql`delete from push_subs where endpoint = ${r.endpoint}`;
        return res.status;
      } catch { return 0; }
    }));
    return j({ ok: true, sent: out.filter((s) => s >= 200 && s < 300).length, status: out });
  }
  return j({ error: "action" }, 400);
});
