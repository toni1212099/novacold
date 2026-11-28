// Server-side validation for checkout answers (used by create-client).
// Everything from the browser is untrusted: only known keys, only strings (consent: boolean),
// length limits, allowed select values, and email/phone/website formats are enforced here.

const PLANS = { starter: 'Starter', pro: 'Pro' };

const EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const PHONE = /^\+?[\d\s().-]{7,25}$/;

// key in request -> Airtable field, max length, required, allowed values (selects), kind
const FIELDS = [
  ['fullName',       'Full name',        100,  true,  null, 'line'],
  ['businessName',   'Business name',    150,  true,  null, 'line'],
  ['email',          'Email',            254,  true,  null, 'email'],
  ['mobile',         'Mobile',            30,  true,  null, 'phone'],
  ['businessPhone',  'Business phone',     30,  true,  null, 'phone'],
  ['website',        'Website',           200, false, null, 'url'],
  ['businessType',   'Business type',      20, true,  ['Plumbing', 'HVAC', 'Both', 'Other']],
  ['services',       'Services',         1000, true,  null, 'text'],
  ['serviceArea',    'Service area',      500, true,  null, 'text'],
  ['hours',          'Hours',             300, true,  null, 'text'],
  ['emergencies',    '24/7 emergencies',    5, true,  ['Yes', 'No']],
  ['booking',        'Booking method',     20, true,  ['Callback', 'Time windows', 'Calendar']],
  ['callsToAnswer',  'Calls to answer',    20, true,  ['Missed only', 'After-hours only', 'All calls']],
  ['carrier',        'Carrier',            20, true,  ['AT&T', 'Verizon', 'T-Mobile', 'Other mobile', 'Office/VoIP']],
  ['transferNumber', 'Transfer number',    30, false, null, 'phone'],
  ['voice',          'Voice',              10, true,  ['Female', 'Male']],
  ['faqs',           'FAQs',             3000, false, null, 'text'],
  ['neverSay',       'Never say',        1500, false, null, 'text'],
];

// Every key the browser may send. Anything else is rejected.
export const ALLOWED_KEYS = new Set(['plan', 'consent', 'hp', ...FIELDS.map((f) => f[0])]);

function clean(v) {
  if (v == null) return '';
  if (typeof v !== 'string') return null; // only strings accepted
  // Drop control characters (keep newline/tab), normalise line endings, trim.
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g, '').trim();
}

// Stop text being treated as a formula if the table is ever exported to Excel/Sheets.
function noFormula(v) { return /^[=@]/.test(v) ? "'" + v : v; }

export function validate(data) {
  const errors = {};
  const plan = PLANS[data.plan];
  if (typeof data.plan !== 'string' || !plan) errors.plan = 'Unknown plan';
  if (data.consent !== true) errors.consent = 'Required';

  const fields = {};
  for (const [key, name, max, required, options, kind] of FIELDS) {
    if (key === 'transferNumber' && data.plan !== 'pro') continue; // Pro only
    const v = clean(data[key]);
    if (v === null) { errors[key] = 'Invalid value'; continue; }
    if (!v) { if (required) errors[key] = 'Required'; continue; }
    if (v.length > max) { errors[key] = 'Too long'; continue; }
    if (options) { if (!options.includes(v)) errors[key] = 'Not an allowed option'; else fields[name] = v; continue; }
    if (kind !== 'text' && v.includes('\n')) { errors[key] = 'Invalid value'; continue; }
    if (kind === 'email') { if (!EMAIL.test(v)) errors[key] = 'Invalid email'; else fields[name] = v.toLowerCase(); continue; }
    if (kind === 'phone') {
      const digits = v.replace(/\D/g, '').length;
      if (!PHONE.test(v) || digits < 7 || digits > 15) errors[key] = 'Invalid phone number'; else fields[name] = v;
      continue;
    }
    if (kind === 'url') {
      try {
        const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
        if (!/^https?:$/.test(u.protocol) || u.username || u.password || !/^[a-z0-9.-]+\.[a-z]{2,63}$/i.test(u.hostname) || u.href.length > max) throw new Error();
        fields[name] = u.href;
      } catch { errors[key] = 'Invalid website'; }
      continue;
    }
    fields[name] = noFormula(v);
  }
  fields['Plan'] = plan;
  fields['Status'] = 'Form filled';
  return { errors, fields };
}
