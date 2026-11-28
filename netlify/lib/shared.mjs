// Shared helpers for the NovaCold Netlify Functions.
// Secrets come ONLY from environment variables set in Netlify (never from the browser or the repo).

export const TABLE = 'Clients';
const MAX_BODY_BYTES = 20000;

/* ---------------- Responses ---------------- */

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

/* ---------------- Origin check (CORS) ----------------
   Only pages on our own site may call the functions. Browsers always send an Origin
   header on POST, so requests from other websites are refused here. (A script outside
   a browser can fake Origin; the other checks below still apply to it.) */

function allowedOrigins() {
  const list = ['https://novacold.agency', 'https://www.novacold.agency'];
  // Netlify sets these automatically: main site URL and the URL of this deploy.
  for (const v of [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL]) if (v) list.push(v);
  // Optional extra origins, comma separated (e.g. for local testing).
  for (const v of (process.env.ALLOWED_ORIGINS || '').split(',')) if (v.trim()) list.push(v.trim());
  return new Set(list.map((u) => u.replace(/\/+$/, '').toLowerCase()));
}

export function checkOrigin(req) {
  const origin = (req.headers.get('origin') || '').toLowerCase();
  if (!origin || !allowedOrigins().has(origin)) throw json(403, { error: 'Forbidden' });
  return origin;
}

/* ---------------- Rate limiting (per IP, best effort) ----------------
   Netlify keeps a function instance warm between requests, so this in-memory limiter
   stops simple floods from one IP. It is not shared between instances, so create-client
   also enforces a global cap on new Airtable records (see create-client.mjs). */

const hits = new Map();
export function clientIp(req) {
  return req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}
export function rateLimit(req, name, limit, windowMs) {
  const key = name + '|' + clientIp(req);
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) throw json(429, { error: 'Too many requests. Please wait a few minutes and try again.' }, { 'Retry-After': String(Math.ceil(windowMs / 1000)) });
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
}

/* ---------------- Request body ---------------- */

// Read and parse a JSON POST body with a size cap. Returns a plain object or throws a Response.
export async function readJson(req) {
  if (req.method !== 'POST') throw json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  const type = req.headers.get('content-type') || '';
  if (!type.toLowerCase().startsWith('application/json')) throw json(415, { error: 'Expected JSON' });
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw json(413, { error: 'Request too large' });
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw json(413, { error: 'Request too large' });
  let data;
  try { data = JSON.parse(text); } catch { throw json(400, { error: 'Invalid request' }); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw json(400, { error: 'Invalid request' });
  return data;
}

// Reject any key that is not in the allowed list.
export function onlyKeys(data, allowed) {
  for (const k of Object.keys(data)) if (!allowed.has(k)) throw json(400, { error: 'Invalid request' });
}

// Standard wrapper: origin check, then the handler; any unexpected error becomes a generic 500.
export function handler(name, fn) {
  return async (req) => {
    try {
      if (req.method === 'OPTIONS') {
        // Same-origin requests never need a preflight; answer it without granting cross-origin access.
        checkOrigin(req);
        return new Response(null, { status: 204 });
      }
      checkOrigin(req);
      return await fn(req);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(name + ' failed:', e && e.message ? e.message : e);
      return json(500, { error: 'Something went wrong. Please try again.' });
    }
  };
}

/* ---------------- Airtable ---------------- */

export function airtableConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    console.error('AIRTABLE_TOKEN or AIRTABLE_BASE_ID is not set');
    throw json(500, { error: 'Something went wrong. Please try again.' });
  }
  return { token, url: `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(TABLE)}` };
}

// Call Airtable. Details of any failure are logged server-side only; the browser gets a generic message.
export async function airtable(path, init = {}) {
  const { token, url } = airtableConfig();
  const res = await fetch(url + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Airtable error', res.status, JSON.stringify(body).slice(0, 300));
    if (res.status === 404) throw json(404, { error: 'Not found' });
    throw json(502, { error: 'Could not save your details. Please try again.' });
  }
  return body;
}

export const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
