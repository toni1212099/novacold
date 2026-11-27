// Shared helpers for the NovaCold Netlify Functions.
// Secrets come ONLY from environment variables set in Netlify (never from the browser or the repo).

export const TABLE = 'Clients';
const MAX_BODY_BYTES = 20000;

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Read and parse a JSON POST body with a size cap. Returns an object or throws a Response.
export async function readJson(req) {
  if (req.method !== 'POST') throw json(405, { error: 'Method not allowed' });
  const type = req.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw json(415, { error: 'Expected JSON' });
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw json(413, { error: 'Request too large' });
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
    return data;
  } catch {
    throw json(400, { error: 'Invalid JSON' });
  }
}

export function airtableConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    console.error('AIRTABLE_TOKEN or AIRTABLE_BASE_ID is not set');
    throw json(500, { error: 'Server is not configured' });
  }
  return { token, url: `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(TABLE)}` };
}

// Call Airtable; on failure log details server-side and return a generic error to the browser.
export async function airtable(path, init = {}) {
  const { token, url } = airtableConfig();
  const res = await fetch(url + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Airtable error', res.status, JSON.stringify(body).slice(0, 500));
    throw json(res.status === 404 ? 404 : 502, { error: res.status === 404 ? 'Record not found' : 'Could not save your details. Please try again.' });
  }
  return body;
}

export const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
