/* NovaCold checkout: 4 steps -> Airtable (create-client) -> PayPal subscription -> mark-paid */
(function () {
  'use strict';

  var PAYPAL_CLIENT_ID = 'BAA_ZZj4f2oq4nsWLjn3IBnhz9sOscVaDQ5HRoQDLa9Wa4qxV_x0HBrH7Az-KXY9b_gawAgyliwXotDlD4'; // public client ID
  var PLANS = {
    starter: { name: 'Starter', price: '$284/mo after 7-day free trial', planId: 'P-53H91552A0754082TNMEGOIY', payNote: 'Your 7-day free trial starts today. $284/month after the trial.' },
    pro:     { name: 'Pro',     price: '$490/mo, starts today',          planId: 'P-7E879931UB2338623NMEGSPY', payNote: '$490/month, billed from today.' }
  };
  var STORE = 'novacold-checkout';
  var FN = '/.netlify/functions/';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var form = $('[data-checkout]');
  var steps = $$('[data-step]', form);
  var backBtn = $('[data-back]');
  var nextBtn = $('[data-next]');
  var alertBox = $('[data-alert]');
  var current = 1;

  var saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(STORE)) || {}; } catch (e) { saved = {}; }
  var params = new URLSearchParams(location.search);
  var plan = PLANS[params.get('plan')] ? params.get('plan') : (PLANS[saved.plan] ? saved.plan : 'starter');

  /* ---------- Plan ---------- */
  function setPlan(p) {
    plan = p;
    var info = PLANS[p];
    $('[data-plan-name]').textContent = info.name;
    $('[data-plan-price]').textContent = info.price;
    $('[data-pay-note]').textContent = info.payNote;
    var other = p === 'pro' ? 'starter' : 'pro';
    var sw = $('[data-switch-plan]');
    sw.textContent = 'Switch to ' + PLANS[other].name;
    sw.href = '?plan=' + other;
    $$('[data-pro-only]').forEach(function (el) { el.hidden = p !== 'pro'; });
    document.title = 'Checkout: ' + info.name + ' | NovaCold';
    var url = new URL(location.href); url.searchParams.set('plan', p);
    history.replaceState(null, '', url);
    save();
  }
  $('[data-switch-plan]').addEventListener('click', function (e) {
    e.preventDefault();
    setPlan(plan === 'pro' ? 'starter' : 'pro');
  });

  /* ---------- Answers (kept in memory + sessionStorage so Back/refresh keep them) ---------- */
  function answers() {
    var data = { plan: plan };
    $$('input, textarea', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
      else if (el.type === 'checkbox') data[el.name] = el.checked;
      else data[el.name] = el.value.trim();
    });
    if (plan !== 'pro') delete data.transferNumber;
    return data;
  }
  function restore() {
    var a = saved.answers || {};
    Object.keys(a).forEach(function (k) {
      $$('[name="' + k + '"]', form).forEach(function (el) {
        if (el.type === 'radio') el.checked = el.value === a[k];
        else if (el.type === 'checkbox') el.checked = a[k] === true;
        else if (k !== 'hp') el.value = a[k];
      });
    });
  }
  function save() {
    saved.plan = plan;
    saved.answers = answers();
    try { sessionStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) {}
  }
  form.addEventListener('input', function (e) {
    save();
    var f = e.target.closest('.field');
    if (f && f.classList.contains('has-error')) checkField(f);
  });
  form.addEventListener('change', save);

  /* ---------- Validation ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validPhone(v) { var d = v.replace(/\D/g, ''); return /^[+\d\s().-]+$/.test(v) && d.length >= 7 && d.length <= 15; }
  function validUrl(v) { try { var u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); return u.hostname.indexOf('.') > 0; } catch (e) { return false; } }

  function checkField(field) {
    if (field.hidden || field.closest('[hidden]')) return true;
    var ok = true;
    var radios = $$('input[type=radio]', field);
    var box = $('input[type=checkbox]', field);
    var input = $('input:not([type=radio]):not([type=checkbox]), textarea', field);
    if (radios.length) ok = radios.some(function (r) { return r.checked; });
    else if (box) ok = !box.required || box.checked;
    else if (input) {
      var v = input.value.trim();
      if (!v) ok = !input.required;
      else if (input.type === 'email') ok = EMAIL.test(v);
      else if (input.hasAttribute('data-phone')) ok = validPhone(v);
      else if (input.hasAttribute('data-url')) ok = validUrl(v);
    }
    field.classList.toggle('has-error', !ok);
    return ok;
  }
  function checkStep(n) {
    var fields = $$('.field', steps[n - 1]);
    var bad = fields.filter(function (f) { return !checkField(f); });
    if (bad.length) {
      var el = $('input, textarea', bad[0]);
      bad[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el) el.focus({ preventScroll: true });
    }
    return !bad.length;
  }

  /* ---------- Navigation ---------- */
  function show(n) {
    current = n;
    steps.forEach(function (s) { s.hidden = +s.getAttribute('data-step') !== n; });
    $('[data-bar]').style.width = (n * 25) + '%';
    $$('li', $('[data-steps]')).forEach(function (li, i) {
      li.className = i + 1 < n ? 'is-done' : (i + 1 === n ? 'is-current' : '');
    });
    backBtn.hidden = n === 1;
    nextBtn.hidden = n === 4;
    nextBtn.textContent = n === 3 ? 'Continue to payment' : 'Next';
    $('[data-switch-plan]').hidden = n === 4;
    showAlert('');
    if (n === 4) loadPayPal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var h = $('h1', steps[n - 1]); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function showAlert(msg) { alertBox.textContent = msg; alertBox.hidden = !msg; }

  backBtn.addEventListener('click', function () { if (current > 1) show(current - 1); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (current >= 4 || nextBtn.disabled) return;
    if (!checkStep(current)) return;
    if (current < 3) return show(current + 1);
    submitAnswers();
  });

  /* ---------- Step 3 -> create-client ---------- */
  function submitAnswers() {
    var data = answers();
    var snapshot = JSON.stringify(data);
    if (saved.recordId && saved.snapshot === snapshot) return show(4); // nothing changed: reuse record

    nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; showAlert('');
    fetch(FN + 'create-client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: snapshot
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
    }).then(function (r) {
      if (!r.ok || !r.body.id) {
        var errs = r.body.fields || {};
        var keys = Object.keys(errs);
        if (keys.length) {
          keys.forEach(function (k) { var el = $('[name="' + k + '"]', form); if (el) el.closest('.field').classList.add('has-error'); });
          var first = $('[name="' + keys[0] + '"]', form);
          var step = first ? +first.closest('[data-step]').getAttribute('data-step') : 3;
          if (step !== current) show(step);
        }
        throw new Error(r.body.error || 'Could not save your details. Please try again.');
      }
      saved.recordId = r.body.id;
      saved.snapshot = snapshot;
      save();
      show(4);
    }).catch(function (err) {
      showAlert(err.message && err.message !== 'Failed to fetch' ? err.message : 'Connection problem. Please try again.');
    }).then(function () {
      nextBtn.disabled = false; nextBtn.textContent = current === 3 ? 'Continue to payment' : 'Next';
    });
  }

  /* ---------- Step 4: PayPal ---------- */
  var sdkPromise = null;
  function loadSdk() {
    if (window.paypal) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=' + PAYPAL_CLIENT_ID + '&vault=true&intent=subscription';
      s.setAttribute('data-sdk-integration-source', 'button-factory');
      s.onload = resolve;
      s.onerror = function () { sdkPromise = null; reject(new Error('PayPal failed to load')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  var renderedFor = null;
  function loadPayPal() {
    var key = plan + '|' + saved.recordId;
    if (renderedFor === key) return;
    var box = $('#paypal-buttons');
    box.innerHTML = '<p class="paypal-loading">Loading secure payment…</p>';
    loadSdk().then(function () {
      box.innerHTML = '';
      renderedFor = key;
      var recordId = saved.recordId;
      return window.paypal.Buttons({
        style: { shape: 'pill', color: 'blue', layout: 'vertical', label: 'subscribe' },
        createSubscription: function (data, actions) {
          return actions.subscription.create({ plan_id: PLANS[plan].planId, custom_id: recordId });
        },
        onApprove: function (data) {
          return fetch(FN + 'mark-paid', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordId: recordId, subscriptionId: data.subscriptionID })
          }).then(function (res) {
            if (!res.ok) console.error('mark-paid failed', res.status); // payment itself succeeded; we follow up manually
          }).catch(function (e) { console.error('mark-paid failed', e); }).then(done);
        },
        onError: function (err) {
          console.error(err);
          showAlert('PayPal had a problem processing this. Please try again, or contact us.');
        }
      }).render('#paypal-buttons');
    }).catch(function () {
      renderedFor = null;
      box.innerHTML = '<p class="paypal-loading">Couldn\'t load PayPal. Check your connection and <a href="#" data-retry style="text-decoration:underline">try again</a>.</p>';
      $('[data-retry]', box).addEventListener('click', function (e) { e.preventDefault(); loadPayPal(); });
    });
  }

  function done() {
    $('[data-pay]').hidden = true;
    $('[data-nav]').hidden = true;
    showAlert('');
    var d = $('[data-done]'); d.hidden = false; d.focus();
    $('[data-bar]').style.width = '100%';
    $$('li', $('[data-steps]')).forEach(function (li) { li.className = 'is-done'; });
    try { sessionStorage.removeItem(STORE); } catch (e) {}
  }

  /* ---------- Start ---------- */
  restore();
  setPlan(plan);
  show(1);
})();
