/* NovaCold — site behavior. Settings live in /site.config.js */
(function () {
  'use strict';

  // Enables the scroll fade-ins. Set here (not inline) so content stays visible if this file fails to load.
  document.documentElement.classList.add('js');

  var cfg = window.SITE_CONFIG || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var clean = function (v) { return v == null ? '' : String(v).trim(); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Config → page ---------------- */
  var phone = clean(cfg.demoPhoneNumber);
  var telHref = phone ? 'tel:' + phone.replace(/[^\d+]/g, '') : '';
  var booking = clean(cfg.bookingLink);
  if (booking && !/^https?:\/\//i.test(booking)) booking = 'https://' + booking;
  var email = clean(cfg.email);
  var currency = clean(cfg.currencySymbol) || '$';
  var trialDays = parseInt(cfg.trialDays, 10);
  if (!(trialDays > 0)) trialDays = 0;

  $$('[data-cta="phone"]').forEach(function (a) {
    if (telHref) { a.href = telHref; a.hidden = false; }
    else a.remove();
  });
  $$('[data-cta="booking"]').forEach(function (a) {
    if (booking) { a.href = booking; a.hidden = false; }
    else a.remove();
  });
  // With no demo phone, the booking button becomes the main (glowing) action.
  if (!telHref && booking) {
    $$('[data-cta="booking"]').forEach(function (a) {
      a.classList.remove('btn-ghost'); a.classList.add('btn-primary');
    });
  }
  // A CTA group with no buttons left is hidden entirely (including its note).
  $$('[data-cta-group]').forEach(function (g) {
    if (!g.querySelector('[data-cta]')) g.hidden = true;
  });

  $$('[data-phone-line]').forEach(function (p) {
    if (!telHref) return p.remove();
    var link = $('[data-phone-text]', p);
    link.href = telHref; link.textContent = phone; p.hidden = false;
  });

  $$('[data-email]').forEach(function (a) {
    if (!email) return a.remove();
    a.href = 'mailto:' + email; a.textContent = email; a.hidden = false;
  });

  // Free-trial wording
  if (!trialDays) $$('[data-trial]').forEach(function (el) { el.remove(); });
  var offerTitle = $('[data-offer-title]');
  var offerLead = $('[data-offer-lead]');
  if (offerTitle) {
    if (trialDays) {
      offerTitle.textContent = 'Try it free for ' + trialDays + (trialDays === 1 ? ' day' : ' days') + '. No contract.';
    } else {
      offerTitle.textContent = 'No contract. Cancel anytime.';
      if (offerLead) offerLead.textContent = 'Let it answer your real calls. See the jobs it books. If it doesn\'t earn its keep, walk away.';
    }
  }

  $$('[data-currency]').forEach(function (el) { el.textContent = currency; });
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------------- Sticky header ---------------- */
  var header = $('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------- Scroll reveal ---------------- */
  var reveals = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    var vh = window.innerHeight || document.documentElement.clientHeight;
    reveals.forEach(function (el) {
      // Anything already on screen shows right away; the rest fades in on scroll.
      if (el.getBoundingClientRect().top < vh) el.classList.add('is-visible');
      else io.observe(el);
    });
    // Safety net: never leave content hidden if the observer is throttled.
    window.addEventListener('load', function () {
      setTimeout(function () {
        if (!document.querySelector('.reveal.is-visible')) reveals.forEach(function (el) { el.classList.add('is-visible'); });
      }, 1500);
    });
  }

  /* ---------------- Calculator ---------------- */
  var calc = $('[data-calc]');
  if (calc) {
    var outMonth = $('[data-out-month]');
    var outYear = $('[data-out-year]');
    var outJobs = $('[data-out-jobs]');
    var WEEKS_PER_MONTH = 52 / 12;
    var limits = { calls: [0, 500], jobValue: [0, 100000], closeRate: [0, 100] };

    var money = function (n) {
      var step = n >= 10000 ? 100 : 10;
      var r = Math.round(n / step) * step;
      return currency + r.toLocaleString('en-US');
    };
    var num = function (key) {
      var v = parseFloat($('[data-num="' + key + '"]', calc).value);
      if (!isFinite(v)) v = 0;
      return Math.min(limits[key][1], Math.max(limits[key][0], v));
    };
    var paintRange = function (r) {
      var min = +r.min, max = +r.max, val = Math.min(max, Math.max(min, +r.value));
      r.style.setProperty('--fill', ((val - min) / (max - min)) * 100 + '%');
    };
    var update = function () {
      var calls = num('calls'), value = num('jobValue'), rate = num('closeRate') / 100;
      var jobsPerMonth = calls * WEEKS_PER_MONTH * rate;
      var perMonth = jobsPerMonth * value;
      outMonth.textContent = '~' + money(perMonth);
      outYear.textContent = money(perMonth * 12);
      outJobs.textContent = String(Math.round(jobsPerMonth));
    };

    $$('[data-range]', calc).forEach(function (range) {
      var key = range.getAttribute('data-range');
      var input = $('[data-num="' + key + '"]', calc);
      paintRange(range);
      range.addEventListener('input', function () { input.value = range.value; paintRange(range); update(); });
      input.addEventListener('input', function () { range.value = input.value || 0; paintRange(range); update(); });
      input.addEventListener('blur', function () {
        var v = num(key);
        input.value = String(v);
      });
    });
    update();
  }

  /* ---------------- Phone mock loop ---------------- */
  var phoneEl = $('[data-phone]');
  if (phoneEl) {
    var bubbles = $$('.bubble', phoneEl);
    var flows = $$('[data-flow]');
    var setState = function (s) {
      phoneEl.setAttribute('data-state', s);
      var active = s === 'sms' ? 'booked' : s;
      flows.forEach(function (f) { f.classList.toggle('is-active', f.getAttribute('data-flow') === active); });
    };

    if (reduceMotion) {
      // Static final frame: job booked + owner text.
      bubbles.forEach(function (b) { b.classList.add('show'); });
      setState('sms');
    } else {
      var timeline = [
        [0, function () { bubbles.forEach(function (b) { b.classList.remove('show'); }); setState('ring'); }],
        [2600, function () { setState('talk'); }],
        [3000, function () { bubbles[0] && bubbles[0].classList.add('show'); }],
        [4300, function () { bubbles[1] && bubbles[1].classList.add('show'); }],
        [5600, function () { bubbles[2] && bubbles[2].classList.add('show'); }],
        [7300, function () { bubbles[3] && bubbles[3].classList.add('show'); }],
        [9000, function () { setState('booked'); }],
        [11000, function () { setState('sms'); }],
      ];
      var LOOP = 15000;
      var timers = [];
      var running = false;
      var run = function () {
        timers.forEach(clearTimeout); timers = [];
        timeline.forEach(function (t) { timers.push(setTimeout(t[1], t[0])); });
        timers.push(setTimeout(run, LOOP));
      };
      var start = function () { if (!running) { running = true; run(); } };
      var stop = function () { running = false; timers.forEach(clearTimeout); timers = []; };

      var visible = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible && !document.hidden) start(); else stop();
        }).observe(phoneEl);
      } else start();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else if (visible) start();
      });
    }
  }

  /* ---------------- Hero waveform background ---------------- */
  var canvas = $('[data-wave]');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var lines = [
      { amp: 0.11, freq: 1.6, speed: 0.55, phase: 0.0, color: '34,211,238', alpha: 0.55, width: 1.6 },
      { amp: 0.08, freq: 2.3, speed: -0.42, phase: 1.3, color: '47,123,255', alpha: 0.45, width: 1.3 },
      { amp: 0.13, freq: 1.1, speed: 0.3, phase: 2.1, color: '103,232,249', alpha: 0.25, width: 1 },
      { amp: 0.06, freq: 3.1, speed: 0.7, phase: 3.7, color: '34,211,238', alpha: 0.3, width: 1 },
      { amp: 0.1, freq: 1.9, speed: -0.25, phase: 4.4, color: '47,123,255', alpha: 0.22, width: 2.2 },
    ];

    var resize = function () {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    var draw = function (t) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      var mid = H - (W < 640 ? 70 : 95);
      var A = Math.min(H, 640) * 0.55; // amplitude base, independent of tall mobile heroes
      var step = W < 640 ? 6 : 4;
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        ctx.beginPath();
        for (var x = 0; x <= W + step; x += step) {
          var p = x / W;
          var env = Math.pow(Math.sin(Math.PI * p), 1.6); // fades at edges
          var y = mid +
            Math.sin(p * Math.PI * 2 * L.freq + t * L.speed + L.phase) * L.amp * A * env +
            Math.sin(p * Math.PI * 2 * (L.freq * 2.7) - t * L.speed * 1.6) * L.amp * 0.25 * A * env;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(' + L.color + ',' + L.alpha + ')';
        ctx.lineWidth = L.width;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();
    var rafId = 0, waveVisible = true;
    var loop = function (ms) { draw(ms / 1000); rafId = requestAnimationFrame(loop); };
    var startWave = function () { if (!rafId && !reduceMotion) rafId = requestAnimationFrame(loop); };
    var stopWave = function () { cancelAnimationFrame(rafId); rafId = 0; };

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { resize(); if (reduceMotion) draw(1.2); }, 120);
    });

    if (reduceMotion) {
      draw(1.2); // one still frame
    } else {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          waveVisible = entries[0].isIntersecting;
          if (waveVisible && !document.hidden) startWave(); else stopWave();
        }).observe(canvas);
      } else startWave();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopWave(); else if (waveVisible) startWave();
      });
    }
  }
})();
