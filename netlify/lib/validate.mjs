// Server-side validation for checkout answers (used by create-client).

const PLANS = { starter: 'Starter', pro: 'Pro' };

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

// key in request  ->  Airtable field, max length, required, allowed values (for selects), kind
const FIELDS = [
  ['fullName',       'Full name',        100,  true],
  ['businessName',   'Business name',    150,  true],
  ['email',          'Email',            254,  true,  null, 'email'],
  ['mobile',         'Mobile',            30,  true,  null, 'phone'],
  ['businessPhone',  'Business phone',     30,  true,  null, 'phone'],
  ['website',        'Website',           200, false, null, 'url'],
  ['businessType',   'Business type',      20, true,  ['Plumbing', 'HVAC', 'Both', 'Other']],
  ['services',       'Services',         1000, true],
  ['serviceArea',    'Service area',      500, true],
  ['hours',          'Hours',             300, true],
  ['emergencies',    '24/7 emergencies',    5, true,  ['Yes', 'No']],
  ['booking',        'Booking method',     20, true,  ['Callback', 'Time windows', 'Calendar']],
  ['callsToAnswer',  'Calls to answer',    20, true,  ['Missed only', 'After-hours only', 'All calls']],
  ['carrier',        'Carrier',            20, true,  ['AT&T', 'Verizon', 'T-Mobile', 'Other mobile', 'Office/VoIP']],
  ['transferNumber', 'Transfer number',    30, false, null, 'phone'],
  ['voice',          'Voice',              10, true,  ['Female', 'Male']],
  ['faqs',           'FAQs',             3000, false],
  ['neverSay',       'Never say',        1500, false],
];

function clean(v) {
  if (v == null) return '';
  if (typeof v !== 'string') return null; // only strings accepted
  // Strip control characters except newlines/tabs, trim.
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function validate(data) {
  const errors = {};
  const plan = PLANS[data.plan];
  if (!plan) errors.plan = 'Unknown plan';
  if (data.consent !== true) errors.consent = 'Consent is required';
  if (data.hp) errors.hp = 'Rejected'; // honeypot field: real people never fill it

  const fields = {};
  for (const [key, name, max, required, options, kind] of FIELDS) {
    if (key === 'transferNumber' && data.plan !== 'pro') continue; // Pro only
    const v = clean(data[key]);
    if (v === null) { errors[key] = 'Invalid value'; continue; }
    if (!v) { if (required) errors[key] = 'Required'; continue; }
    if (v.length > max) { errors[key] = `Too long (max ${max} characters)`; continue; }
    if (options && !options.includes(v)) { errors[key] = 'Not an allowed option'; continue; }
    if (kind === 'email' && !EMAIL.test(v)) { errors[key] = 'Invalid email'; continue; }
    if (kind === 'phone') {
      const digits = v.replace(/\D/g, '');
      if (!/^[+\d\s().-]+$/.test(v) || digits.length < 7 || digits.length > 15) { errors[key] = 'Invalid phone number'; continue; }
    }
    if (kind === 'url') {
      try {
        const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
        if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error();
        fields[name] = u.href; continue;
      } catch { errors[key] = 'Invalid website'; continue; }
    }
    fields[name] = v;
  }
  fields['Plan'] = plan;
  fields['Status'] = 'Form filled';
  return { errors, fields };
}
