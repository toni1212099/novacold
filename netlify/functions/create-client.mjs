// POST /.netlify/functions/create-client
// Validates the checkout answers and creates a record in the Airtable "Clients" table.
// Returns { id: "rec..." }.
import { json, readJson, airtable } from '../lib/shared.mjs';
import { validate } from '../lib/validate.mjs';

export default async (req) => {
  try {
    const data = await readJson(req);
    const { errors, fields } = validate(data);
    if (Object.keys(errors).length) return json(400, { error: 'Please check the highlighted fields.', fields: errors });
    const rec = await airtable('', { method: 'POST', body: JSON.stringify({ fields, typecast: true }) });
    return json(200, { id: rec.id });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('create-client failed', e);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
