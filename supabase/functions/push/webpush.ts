// Web Push (RFC 8291 aes128gcm + VAPID RFC 8292) solo con WebCrypto: corre igual en Deno y en Node 20+.
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const S = crypto.subtle;
async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await S.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await S.sign("HMAC", k, data));
}
const expand = async (prk: Uint8Array, info: Uint8Array, n: number) => (await hmac(prk, cat(info, new Uint8Array([1])))).slice(0, n);

export type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type Vapid = { publicKey: string; privateJwk: JsonWebKey; subject: string };

export async function encrypt(sub: Sub, payload: Uint8Array, salt = crypto.getRandomValues(new Uint8Array(16)), as?: CryptoKeyPair) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  as ??= await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await S.exportKey("raw", as.publicKey));
  const uaKey = await S.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await S.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await expand(await hmac(auth, shared), cat(enc.encode("WebPush: info\0"), ua, asPub), 32);
  const prk = await hmac(salt, ikm);
  const cek = await expand(prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await expand(prk, enc.encode("Content-Encoding: nonce\0"), 12);
  const k = await S.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

export async function vapidHeader(endpoint: string, v: Vapid) {
  const aud = new URL(endpoint).origin;
  const h = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })));
  const key = await S.importKey("jwk", v.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await S.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${h}.${c}`)));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${v.publicKey}`;
}

export async function send(sub: Sub, data: unknown, v: Vapid, ttl = 600) {
  const body = await encrypt(sub, enc.encode(JSON.stringify(data)));
  return fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidHeader(sub.endpoint, v), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(ttl), Urgency: "high" },
    body,
  });
}

export async function newVapid() {
  const kp = await S.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  return { publicKey: b64u(new Uint8Array(await S.exportKey("raw", kp.publicKey))), privateJwk: await S.exportKey("jwk", kp.privateKey) };
}
export { b64u, unb64u };
