// POST /.netlify/functions/mark-paid   body: { recordId, subscriptionId }
// Sets ONLY "Status" = "Paid" and "PayPal subscription ID" on an existing Clients record.
//
// A record is marked Paid only if ALL of these hold:
//  - the request comes from our own site (shared handler) and has exactly these two keys
//    in the expected formats;
//  - PayPal's API (server-side, with our secret credentials) confirms the subscription exists,
//    is APPROVED or ACTIVE, has custom_id equal to this record ID, and uses the plan that matches
//    the record's Plan field;
//  - the record currently has Status "Form filled" (a Paid record can't be overwritten).
//
// Required Netlify env vars: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (live REST app credentials).
// Without them this function refuses to mark anything Paid (fails closed).
// Optional: PAYPAL_API_BASE (default https://api-m.paypal.com; use https://api-m.sandbox.paypal.com to test).
import { json, readJson, onlyKeys, airtable, handler, rateLimit, RECORD_ID } from '../lib/shared.mjs';

const SUBSCRIPTION_ID = /^I-[A-Z0-9]{6,30}$/;
const PLAN_IDS = { Starter: 'P-53H91552A0754082TNMEGOIY', Pro: 'P-7E879931UB2338623NMEGSPY' };
const KEYS = new Set(['recordId', 'subscriptionId']);

async function paypalSubscription(subscriptionId) {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    console.error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set: refusing to mark records as Paid');
    throw json(503, { error: 'Payment received, but we could not confirm it automatically. We will contact you.' });
  }
  const api = (process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com').replace(/\/+$/, '');
  const tokenRes = await fetch(api + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) {
    console.error('PayPal token error', tokenRes.status);
    throw json(502, { error: 'Payment received, but we could not confirm it automatically. We will contact you.' });
  }
  const { access_token } = await tokenRes.json();
  const subRes = await fetch(api + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId), {
    headers: { Authorization: 'Bearer ' + access_token, Accept: 'application/json' },
  });
  if (subRes.status === 404) return null;
  if (!subRes.ok) {
    console.error('PayPal subscription lookup error', subRes.status);
    throw json(502, { error: 'Payment received, but we could not confirm it automatically. We will contact you.' });
  }
  return subRes.json();
}

export default handler('mark-paid', async (req) => {
  rateLimit(req, 'paid', 10, 10 * 60e3); // 10 attempts per IP per 10 minutes
  const data = await readJson(req);
  onlyKeys(data, KEYS);
  const recordId = typeof data.recordId === 'string' ? data.recordId : '';
  const subscriptionId = typeof data.subscriptionId === 'string' ? data.subscriptionId : '';
  if (!RECORD_ID.test(recordId) || !SUBSCRIPTION_ID.test(subscriptionId)) return json(400, { error: 'Invalid request' });

  const rec = await airtable('/' + recordId);
  const f = rec.fields || {};
  if (f['Status'] === 'Paid' && f['PayPal subscription ID'] === subscriptionId) return json(200, { ok: true }); // harmless retry
  if (f['Status'] !== 'Form filled') return json(409, { error: 'Invalid request' });

  const sub = await paypalSubscription(subscriptionId);
  const ok = sub
    && ['APPROVED', 'ACTIVE'].includes(sub.status)
    && sub.custom_id === recordId
    && PLAN_IDS[f['Plan']] && sub.plan_id === PLAN_IDS[f['Plan']];
  if (!ok) {
    console.warn('mark-paid verification failed', { recordId, subscriptionId, status: sub && sub.status });
    return json(400, { error: 'Invalid request' });
  }

  // Only these two fields are ever written by this function.
  await airtable('/' + recordId, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { 'Status': 'Paid', 'PayPal subscription ID': subscriptionId }, typecast: true }),
  });
  return json(200, { ok: true });
});
