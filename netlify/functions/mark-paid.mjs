// POST /.netlify/functions/mark-paid   body: { recordId, subscriptionId }
// Sets ONLY "Status" = "Paid" and "PayPal subscription ID" on an existing Clients record.
//
// Safety checks:
//  - recordId and subscriptionId must have the expected format;
//  - the record must exist and still have Status "Form filled" (a paid record can't be overwritten);
//  - if PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set in Netlify, the subscription is also
//    checked with PayPal: it must exist, be APPROVED/ACTIVE, carry custom_id = recordId and use
//    the plan that matches the record. Without those two variables this PayPal check is skipped.
import { json, readJson, airtable, RECORD_ID } from '../lib/shared.mjs';

const SUBSCRIPTION_ID = /^I-[A-Z0-9]{6,30}$/;
const PLAN_IDS = { Starter: 'P-53H91552A0754082TNMEGOIY', Pro: 'P-7E879931UB2338623NMEGSPY' };

async function verifyWithPayPal(subscriptionId, recordId, plan) {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return true; // not configured: skip
  const api = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
  const tokenRes = await fetch(api + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) { console.error('PayPal token error', tokenRes.status); throw json(502, { error: 'Could not confirm payment' }); }
  const { access_token } = await tokenRes.json();
  const subRes = await fetch(api + '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId), {
    headers: { Authorization: 'Bearer ' + access_token },
  });
  if (!subRes.ok) { console.error('PayPal subscription lookup', subRes.status); return false; }
  const sub = await subRes.json();
  return ['APPROVED', 'ACTIVE'].includes(sub.status) && sub.custom_id === recordId && sub.plan_id === PLAN_IDS[plan];
}

export default async (req) => {
  try {
    const data = await readJson(req);
    const recordId = typeof data.recordId === 'string' ? data.recordId.trim() : '';
    const subscriptionId = typeof data.subscriptionId === 'string' ? data.subscriptionId.trim() : '';
    if (!RECORD_ID.test(recordId) || !SUBSCRIPTION_ID.test(subscriptionId)) {
      return json(400, { error: 'Invalid request' });
    }

    const rec = await airtable('/' + recordId);
    const f = rec.fields || {};
    if (f['Status'] === 'Paid' && f['PayPal subscription ID'] === subscriptionId) return json(200, { ok: true }); // retry
    if (f['Status'] !== 'Form filled') return json(409, { error: 'This signup has already been completed' });

    if (!(await verifyWithPayPal(subscriptionId, recordId, f['Plan']))) {
      return json(400, { error: 'Payment could not be confirmed' });
    }

    await airtable('/' + recordId, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { 'Status': 'Paid', 'PayPal subscription ID': subscriptionId }, typecast: true }),
    });
    return json(200, { ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('mark-paid failed', e);
    return json(500, { error: 'Something went wrong' });
  }
};
