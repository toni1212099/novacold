// POST /.netlify/functions/create-client
// Validates the checkout answers and creates a record in the Airtable "Clients" table.
// Returns { id: "rec..." }.
//
// Abuse protection:
//  - only our own site's Origin is accepted (shared handler);
//  - unknown keys are rejected, every field is type/length/format checked;
//  - hidden honeypot field "hp" must be empty;
//  - per-IP limit (best effort) and a global cap on new records per hour/day, so bots can't
//    fill the Airtable free plan (1,000 records). Caps can be changed with the optional
//    env vars MAX_SIGNUPS_PER_HOUR (default 20) and MAX_SIGNUPS_PER_DAY (default 60).
import { json, readJson, onlyKeys, airtable, handler, rateLimit } from '../lib/shared.mjs';
import { validate, ALLOWED_KEYS } from '../lib/validate.mjs';

const PER_HOUR = Math.max(1, Number(process.env.MAX_SIGNUPS_PER_HOUR) || 20);
const PER_DAY = Math.max(PER_HOUR, Math.min(100, Number(process.env.MAX_SIGNUPS_PER_DAY) || 60));

async function enforceGlobalCap() {
  // Records created in the last 24 hours (fixed formula, no user input). pageSize 100 is enough
  // because PER_DAY is capped at 100.
  const q = new URLSearchParams({
    filterByFormula: "IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -24, 'hours'))",
    pageSize: '100',
  });
  q.append('fields[]', 'Status');
  const { records = [] } = await airtable('?' + q.toString());
  const hourAgo = Date.now() - 3600e3;
  const lastHour = records.filter((r) => Date.parse(r.createdTime) > hourAgo).length;
  if (records.length >= PER_DAY || lastHour >= PER_HOUR) {
    console.warn('Signup cap reached', { lastHour, lastDay: records.length });
    throw json(429, { error: 'We are getting a lot of signups right now. Please try again in an hour.' });
  }
}

export default handler('create-client', async (req) => {
  rateLimit(req, 'create', 5, 10 * 60e3); // 5 submissions per IP per 10 minutes
  const data = await readJson(req);
  onlyKeys(data, ALLOWED_KEYS);
  if (data.hp) {
    console.warn('Honeypot triggered');
    return json(400, { error: 'Invalid request' });
  }
  const { errors, fields } = validate(data);
  if (Object.keys(errors).length) return json(400, { error: 'Please check the highlighted fields.', fields: errors });
  await enforceGlobalCap();
  const rec = await airtable('', { method: 'POST', body: JSON.stringify({ fields, typecast: true }) });
  return json(200, { id: rec.id });
});
