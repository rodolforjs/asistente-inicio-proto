// Regi · chat inteligente (demo). La clave de OpenAI vive solo aquí, como secreto de Supabase (OPENAI_API_KEY).
// POST { messages:[{role:'user'|'assistant', content:string}], image?: dataURL, ctx:{ hoy, usuario, personas:[...], catalogo:[...] } }
// → { reply, action, person, products, fact }
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const ORIGINS = [/^https:\/\/rodolforjs\.github\.io$/, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/];
const KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.5";
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

const SYSTEM = `Eres Regi, el planner de regalos de Creado en Chile (tienda de diseño chileno hecho por creadores locales).
Hablas en primera persona, en español de Chile, cercano, cálido y muy breve: máximo 2 frases cortas (unas 35 palabras). Sin listas largas, sin emojis.
Nunca digas que eres una IA o inteligencia artificial. No uses las palabras: gratis, gratuito, free, premium, suscripción, IA.
No inventes: usa solo las personas, fechas, gustos y productos del contexto. Si algo no lo sabes, dilo simple.
Lo que haces:
- Guardar ideas que el usuario te manda (foto, link, producto) en la ficha de la persona correcta → action "save".
- Anotar algo que aprendes de su gente ("a mi papá le encantó la botella") → action "learn", con fact en tercera persona y corto (ej. "Le encantó la botella").
- Sugerir regalos del catálogo de Creado cuando te pregunten qué regalar → action "suggest" con 1 a 3 handles del catálogo que calcen con los gustos de esa persona y su ocasión. Explica en una frase por qué.
- Si no queda claro para quién es, pregunta → action "ask".
- Responder dudas sobre sus fechas o lo que sabes de su gente → action "none".
Entiendes parentescos y apodos usando el campo rel de cada persona (hermana → la persona cuyo rel es "Tu hermana"; "la vieja"/"mi mamá" → Mamá; "la ofi"/"la oficina" → Amigo secreto; "mi polola"/"mi señora" → Pareja). Cuando uses un parentesco, menciona el nombre ("Tu hermana es Carla").
Si el usuario manda una foto: di en pocas palabras qué ves y busca en el catálogo un producto del mismo tipo de objeto. Si hay uno parecido, ponlo en products; si no, guarda la foto igual (products vacío).
person debe ser exactamente el nombre de la lista (campo n) o null.`;

const SCHEMA = {
  name: "regi", strict: true,
  schema: {
    type: "object", additionalProperties: false,
    required: ["reply", "action", "person", "products", "fact"],
    properties: {
      reply: { type: "string" },
      action: { type: "string", enum: ["save", "learn", "suggest", "ask", "none"] },
      person: { type: ["string", "null"] },
      products: { type: "array", items: { type: "string" } },
      fact: { type: ["string", "null"] },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "method" }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (!ORIGINS.some((r) => r.test(origin))) return j({ error: "origin" }, 403);
  if (!KEY) return j({ error: "sin clave" }, 500);
  let b: Record<string, any>; try { b = await req.json(); } catch { return j({ error: "json" }, 400); }

  const ctx = JSON.stringify(b.ctx ?? {}).slice(0, 24000);
  const hist = (Array.isArray(b.messages) ? b.messages : []).slice(-12)
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
    .map((m: any) => ({ role: m.role, content: clip(m.content, 1200) }));
  if (!hist.length || hist[hist.length - 1].role !== "user") return j({ error: "mensaje" }, 400);
  const img = typeof b.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(b.image) && b.image.length < 2_500_000 ? b.image : null;
  if (img) { const last = hist.pop(); hist.push({ role: "user", content: [{ type: "text", text: last.content || "(foto)" }, { type: "image_url", image_url: { url: img, detail: "low" } }] }); }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, reasoning_effort: "low", max_completion_tokens: 900,
      response_format: { type: "json_schema", json_schema: SCHEMA },
      messages: [{ role: "system", content: SYSTEM }, { role: "system", content: "Contexto de la app (JSON): " + ctx }, ...hist],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return j({ error: "openai", detail: d?.error?.message ?? r.status }, 502);
  try { return j(JSON.parse(d.choices[0].message.content)); }
  catch { return j({ error: "formato" }, 502); }
});
