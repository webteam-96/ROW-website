/* ==========================================================================
   Roster On Wheels — Concept 04 · Kinetic
   GSAP 3.15 (ScrollTrigger, SplitText, DrawSVG, CustomEase) + Lenis 1.3.
   Every scene explains how ROW works. Reduced motion gets the end frames
   (the HTML/CSS defaults); JS only sets "from" states when motion is allowed.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase } = window;
  if (!gsap) { root.classList.remove('js'); return; }
  gsap.registerPlugin(...[ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase].filter(Boolean));
  window.__rowReady = true;
  root.classList.add('js'); // the head script's 3.5s safety net may have removed it on a slow network

  /* ---------- helpers ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(pointer: fine)');
  const mqHover = matchMedia('(hover: hover)');
  const mqDesktop = matchMedia('(min-width: 1024px)');
  const reduced = () => mqReduce.matches;
  const dur = d => (reduced() ? 0 : d);

  if (CustomEase) {
    CustomEase.create('rowOut', '0.22,1,0.36,1');
    CustomEase.create('rowInOut', '0.65,0,0.35,1');
  }
  const OUT = CustomEase ? 'rowOut' : 'expo.out';
  const IN_OUT = CustomEase ? 'rowInOut' : 'power2.inOut';
  gsap.defaults({ ease: OUT });
  if (ScrollTrigger) ScrollTrigger.config({ ignoreMobileResize: true });

  function whenVisible(el, cb, options) {
    if (!el) return () => {};
    if (!('IntersectionObserver' in window)) { cb(true, 1); return () => {}; }
    const io = new IntersectionObserver(entries => entries.forEach(e => cb(e.isIntersecting, e.intersectionRatio, e.target)), options);
    io.observe(el);
    return () => io.disconnect();
  }

  /* ---------- smooth scroll (fine pointers, motion allowed) ---------- */
  let lenis = null;
  if (window.Lenis && ScrollTrigger && mqFine.matches && !reduced()) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;
  }

  function scrollToTarget(target, immediate) {
    if (lenis) { lenis.scrollTo(target, { immediate: !!immediate, force: true }); return; }
    const behavior = immediate || reduced() ? 'auto' : 'smooth';
    if (typeof target === 'number') window.scrollTo({ top: target, behavior });
    else target.scrollIntoView({ behavior, block: 'start' });
  }

  /* ---------- scroll-velocity bus: one ticker, consumers only while on screen ---------- */
  const consumers = new Set();
  let velocity = 0;
  let lastY = window.scrollY;
  let pageHidden = document.hidden;
  const toggleConsumer = (fn, on) => { if (on) consumers.add(fn); else consumers.delete(fn); };
  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(0.05, Math.max(0.001, deltaMs / 1000));
    const y = window.scrollY;
    velocity += ((y - lastY) / dt - velocity) * Math.min(1, dt * 10);
    lastY = y;
    if (Math.abs(velocity) < 1) velocity = 0;
    if (pageHidden || !consumers.size) return;
    consumers.forEach(fn => fn(dt, velocity));
  });
  document.addEventListener('visibilitychange', () => {
    pageHidden = document.hidden;
    if (pageHidden) gsap.globalTimeline.pause();
    else gsap.globalTimeline.resume();
  });

  /* ---------- in-page anchors (Lenis when active), focus moves to the target ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    closeMenus();
    scrollToTarget(target);
    if (history.pushState) history.pushState(null, '', '#' + id);
    if (!target.matches('a, button, input, select, textarea, summary, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------- header: shrink + blur after 80px; dark glass while it sits over an ink/azure band ---------- */
  const header = $('[data-header]');
  const darkBands = $$('main > section.theme-ink, main > section.theme-azure, .site-footer');
  const dialEl = $('[data-dial]');
  function updateHeaderTone() {
    if (!header) return;
    const under = el => { const r = el.getBoundingClientRect(); return r.top <= 32 && r.bottom > 32; };
    // the Year Dial turns to paper at 1 July while it is still pinned under the header
    const dark = darkBands.some(under) && !(dialEl && dialEl.classList.contains('is-after') && under(dialEl));
    header.classList.toggle('on-dark', dark);
  }
  const onScroll = () => {
    if (!header) return;
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 80);
    header.style.setProperty('--glass', Math.min(1, y / 80).toFixed(2));
    updateHeaderTone();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- desktop nav: sliding pill + mega menus ---------- */
  const nav = $('.nav');
  const navList = $('.nav-list');
  const pill = $('.nav-pill');
  const triggers = $$('.nav-trigger');
  let openBtn = null;
  let openedAt = 0;
  let openTimer = 0;
  let closeTimer = 0;
  const panelOf = btn => document.getElementById(btn.getAttribute('aria-controls'));

  function movePill(el) {
    if (!pill || !el) return;
    gsap.to(pill, { x: el.offsetLeft, width: el.offsetWidth, autoAlpha: 1, duration: dur(0.32), ease: OUT, overwrite: true });
  }
  function restPill() {
    if (!pill) return;
    if (openBtn) movePill(openBtn);
    else gsap.to(pill, { autoAlpha: 0, duration: dur(0.2), overwrite: true });
  }
  function openMega(btn) {
    clearTimeout(closeTimer);
    if (openBtn === btn) return;
    if (openBtn) closeMega(true);
    const panel = panelOf(btn);
    if (!panel || !header) return;
    openBtn = btn;
    openedAt = performance.now();
    btn.setAttribute('aria-expanded', 'true');
    header.classList.add('mega-open');
    panel.hidden = false;
    gsap.fromTo(panel, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: dur(0.32), ease: OUT, overwrite: true, clearProps: 'height' });
    gsap.fromTo($$('.mega-lead, .mega-link', panel), { y: 10, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: dur(0.4), stagger: reduced() ? 0 : 0.035, delay: dur(0.06), ease: OUT, overwrite: true, clearProps: 'transform' });
    movePill(btn);
  }
  function closeMega(instant) {
    clearTimeout(openTimer);
    if (!openBtn) return;
    const btn = openBtn;
    const panel = panelOf(btn);
    openBtn = null;
    btn.setAttribute('aria-expanded', 'false');
    if (header) header.classList.remove('mega-open');
    if (!panel) return;
    gsap.to(panel, {
      height: 0, autoAlpha: 0, duration: instant ? 0 : dur(0.24), ease: IN_OUT, overwrite: true,
      onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: 'height,opacity,visibility' }); }
    });
  }

  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      if (openBtn !== btn) openMega(btn);
      else if (performance.now() - openedAt > 400) { closeMega(); restPill(); }
    });
    btn.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      movePill(btn);
      clearTimeout(openTimer);
      openTimer = setTimeout(() => openMega(btn), openBtn ? 0 : 110);
    });
    btn.addEventListener('pointerleave', () => clearTimeout(openTimer));
    btn.addEventListener('focus', () => movePill(btn));
  });
  if (navList) navList.addEventListener('pointerleave', restPill);
  if (header) {
    header.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse' && openBtn) closeTimer = setTimeout(() => { closeMega(); restPill(); }, 260);
    });
    header.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  }
  if (nav) nav.addEventListener('focusout', e => { if (openBtn && !nav.contains(e.relatedTarget)) { closeMega(); restPill(); } });
  document.addEventListener('pointerdown', e => { if (openBtn && !e.target.closest('.nav')) { closeMega(); restPill(); } });

  /* ---------- full-screen menu below 1024px ---------- */
  const burger = $('.burger');
  const menu = $('#mobile-menu');
  const main = $('#main');
  const footer = $('.site-footer');
  let menuOpen = false;

  function setMenu(open) {
    if (!burger || !menu || open === menuOpen) return;
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    root.classList.toggle('menu-open', open);
    [main, footer].forEach(el => { if (el) el.inert = open; });
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    gsap.killTweensOf(menu);
    if (open) {
      menu.hidden = false;
      if (!reduced()) {
        gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: IN_OUT, clearProps: 'clipPath' });
        gsap.fromTo($$('.mm-group, .mm-ctas', menu), { y: 28, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, delay: 0.12, ease: OUT, clearProps: 'transform,opacity,visibility' });
      }
    } else {
      gsap.to(menu, {
        clipPath: 'inset(0% 0% 100% 0%)', duration: dur(0.3), ease: IN_OUT,
        onComplete: () => { menu.hidden = true; gsap.set(menu, { clearProps: 'clipPath' }); }
      });
    }
  }
  function closeMenus() {
    if (openBtn) { closeMega(); restPill(); }
    setMenu(false);
  }
  if (burger) burger.addEventListener('click', () => setMenu(!menuOpen));
  if (header) header.addEventListener('keydown', e => {
    if (!menuOpen || e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled])', header)
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (openBtn) { const b = openBtn; closeMega(); restPill(); b.focus(); }
    if (menuOpen) { setMenu(false); burger.focus(); }
  });
  mqDesktop.addEventListener('change', () => { setMenu(false); closeMega(true); restPill(); });

  /* ---------- FAQ: native <details>, animated height, hash follows ---------- */
  (function initFaq() {
    const items = $$('.faq-item');
    const hash = decodeURIComponent(location.hash.slice(1));
    items.forEach(d => {
      if (d.id && d.id === hash) d.open = true;
      d.classList.toggle('is-open', d.open);
      const summary = $('summary', d);
      const answer = $('.faq-a', d);
      if (!summary || !answer) return;
      summary.addEventListener('click', e => {
        if (reduced()) return; // native toggle; the toggle event syncs class and hash
        e.preventDefault();
        const opening = !d.classList.contains('is-open');
        gsap.killTweensOf(answer);
        d.classList.toggle('is-open', opening);
        if (opening) {
          d.open = true;
          gsap.fromTo(answer, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.32, ease: OUT, clearProps: 'height,opacity' });
        } else {
          gsap.to(answer, {
            height: 0, opacity: 0, duration: 0.28, ease: IN_OUT,
            onComplete: () => { d.open = false; gsap.set(answer, { clearProps: 'height,opacity' }); }
          });
        }
      });
      d.addEventListener('toggle', () => {
        d.classList.toggle('is-open', d.open);
        if (d.open && d.id && history.replaceState) history.replaceState(null, '', '#' + d.id);
      });
    });
  })();

  /* ---------- demo form: floating labels are CSS; submit is a sample ---------- */
  (function initForm() {
    const form = $('.demo-form');
    if (!form) return;
    const status = $('.form-status', form);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const trial = e.submitter && e.submitter.value === 'trial';
      const name = form.elements.name ? form.elements.name.value.trim().split(/\s+/)[0] : '';
      if (status) status.textContent = `Thanks${name ? ', ' + name : ''}. This is a design sample, so your ${trial ? 'trial' : 'demo'} request was not sent.`;
    });
  })();

  /* ---------- magnetic CTAs (hero + closing band), fine pointers only, max 6px ---------- */
  if (mqFine.matches && !reduced()) {
    $$('[data-magnetic]').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        let mx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        let my = (e.clientY - (r.top + r.height / 2)) * 0.3;
        const m = Math.hypot(mx, my);
        if (m > 6) { mx *= 6 / m; my *= 6 / m; }
        gsap.to(btn, { '--mx': mx, '--my': my, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
      });
      btn.addEventListener('pointerleave', () => gsap.to(btn, { '--mx': 0, '--my': 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' }));
    });
  }

  /* ======================================================================
     Motion scenes — each returns an optional cleanup for gsap.matchMedia
     ====================================================================== */

  /* ---------- 01 hero: entrance + the type wheel turning with scroll velocity ---------- */
  function initHero() {
    const hero = $('.hero');
    if (!hero) return null;
    const els = $$('[data-hero]', hero);
    els.forEach(el => el.classList.add('is-in'));
    gsap.fromTo(els, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, delay: 0.25, ease: OUT, clearProps: 'all' });
    const wheel = $('.tw', hero);
    if (wheel) gsap.from(wheel, { autoAlpha: 0, duration: 1.4, delay: 0.1, ease: 'power1.out' });

    const outer = $('.tw-outer', hero);
    const inner = $('.tw-inner', hero);
    if (!outer || !inner) return null;
    const setOuter = gsap.quickSetter(outer, 'rotation', 'deg');
    const setInner = gsap.quickSetter(inner, 'rotation', 'deg');
    let angle = -40;
    let boost = 110; // the wheel arrives already rolling, then settles
    const spin = (dt, v) => {
      boost *= Math.pow(0.3, dt);
      angle += (4 + boost + v * 0.05) * dt;
      setOuter(angle);
      setInner(angle * -0.6);
    };
    const stop = whenVisible(hero, vis => toggleConsumer(spin, vis));
    return () => { stop(); toggleConsumer(spin, false); gsap.set([outer, inner], { clearProps: 'transform' }); };
  }

  /* ---------- 01 hero H1: masked line rise, then each word's width answers scroll velocity + pointer x ---------- */
  function initHeroTitle() {
    const hero = $('.hero');
    const h1 = $('.hero-title');
    if (!h1) return null;
    if (!SplitText) { h1.classList.add('is-split'); return null; }
    const REST = 84;
    const MAX = 125;
    let words = [];
    let lines = [];
    let cur = [];
    let centers = [];
    let amp = 0;
    let live = false;
    let px = null;

    const lineWidth = line => {
      const ws = line.querySelectorAll('.h-word');
      return ws.length ? ws[ws.length - 1].getBoundingClientRect().right - line.getBoundingClientRect().left : 0;
    };
    // How far can words stretch before the widest line would leave the column? Measured, never guessed.
    const measure = () => {
      if (!lines.length) return;
      const box = h1.getBoundingClientRect();
      const setAll = v => words.forEach(w => w.style.setProperty('--wd', v));
      setAll(REST);
      const rest = lines.map(lineWidth);
      setAll(MAX);
      const wide = lines.map(lineWidth);
      setAll(REST);
      let frac = 1;
      lines.forEach((l, i) => {
        const d = wide[i] - rest[i];
        if (d > 0.5) frac = Math.min(frac, (box.width - rest[i]) / d);
      });
      amp = Math.max(0, Math.min(1, frac)) * (MAX - REST) * 0.92;
      centers = words.map(w => { const r = w.getBoundingClientRect(); return r.left + r.width / 2 - box.left; });
      words.forEach(w => w.style.removeProperty('--wd'));
      cur = words.map(() => REST);
    };

    SplitText.create(h1, {
      type: 'lines,words', mask: 'lines', linesClass: 'h-line', wordsClass: 'h-word', autoSplit: true,
      onSplit(self) {
        words = self.words;
        lines = self.lines;
        measure();
        h1.classList.add('is-split');
        return gsap.timeline({ onComplete: () => { live = true; } })
          .from(self.lines, { yPercent: 150, duration: 1, stagger: 0.08, ease: OUT }, 0)
          .from(self.lines, { '--wd': 62, duration: 1.4, stagger: 0.08, ease: OUT }, 0);
      }
    });

    if (hero && mqFine.matches) {
      hero.addEventListener('pointermove', e => { px = e.clientX - h1.getBoundingClientRect().left; }, { passive: true });
      hero.addEventListener('pointerleave', () => { px = null; });
    }
    const stretch = (dt, v) => {
      if (!live || amp < 1) return;
      const fromSpeed = Math.min(1, Math.abs(v) / 2400) * amp;
      const k = Math.min(1, dt * 8);
      for (let i = 0; i < words.length; i++) {
        let t = REST + fromSpeed;
        if (px !== null) { const d = (px - centers[i]) / 240; t += Math.exp(-d * d) * amp * 0.55; }
        t = Math.min(REST + amp, t);
        const c = cur[i] + (t - cur[i]) * k;
        if (Math.abs(c - cur[i]) > 0.04) { cur[i] = c; words[i].style.setProperty('--wd', c.toFixed(2)); }
      }
    };
    const stop = whenVisible(h1, vis => toggleConsumer(stretch, vis));
    return () => { stop(); toggleConsumer(stretch, false); };
  }

  /* ---------- H2s: masked line rise while the width settles (wdth 62 → rest) ---------- */
  function initHeadings() {
    const hs = $$('.split-h');
    if (!SplitText) { hs.forEach(h => h.classList.add('is-split')); return null; }
    hs.forEach(h => {
      SplitText.create(h, {
        type: 'lines', mask: 'lines', linesClass: 's-line', autoSplit: true,
        onSplit(self) {
          h.classList.add('is-split');
          return gsap.from(self.lines, {
            yPercent: 140, '--wd': 62, duration: 1.05, stagger: 0.08, ease: OUT,
            scrollTrigger: { trigger: h, start: 'top 86%', once: true }
          });
        }
      });
    });
    return () => hs.forEach(h => h.classList.remove('is-split'));
  }

  /* ---------- generic reveals: rise 24px + fade, once ---------- */
  function initReveals() {
    $$('[data-reveal]').forEach(el => {
      el.classList.add('is-in');
      gsap.fromTo(el, { autoAlpha: 0, y: 24 }, {
        autoAlpha: 1, y: 0, duration: 0.7, ease: OUT, clearProps: 'all',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
    return null;
  }

  /* ---------- 02 proof: count up once over 1.2s, box width reserved, final text exact ---------- */
  function initCounters() {
    const finals = [];
    $$('[data-count]').forEach(el => {
      const final = el.textContent.trim();
      const m = final.match(/^([\d,]+)(.*)$/);
      if (!m) return;
      finals.push([el, final]);
      const target = parseInt(m[1].replace(/,/g, ''), 10);
      const suffix = m[2];
      el.style.minWidth = Math.ceil(el.getBoundingClientRect().width) + 'px';
      el.textContent = '0' + suffix;
      const o = { v: 0 };
      gsap.to(o, {
        v: target, duration: 1.2, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US') + suffix; },
        onComplete: () => { el.textContent = final; }
      });
    });
    return () => finals.forEach(([el, final]) => { el.textContent = final; el.style.minWidth = ''; });
  }

  /* ---------- tickers: sync lanes (records travel both ways) + language marquee ---------- */
  function makeTicker(track) {
    const inner = track.firstElementChild;
    if (!inner || !inner.children.length) return null;
    const base = parseFloat(track.dataset.ticker) || 40;
    const signed = !track.classList.contains('lane-track'); // sync lanes never run backwards
    const originals = Array.from(inner.children);
    const addSet = () => originals.forEach(n => { const c = n.cloneNode(true); c.classList.add('is-clone'); inner.appendChild(c); });
    let period = 0;
    let x = 0;
    const measure = () => {
      const clone = inner.querySelector('.is-clone');
      period = clone ? clone.offsetLeft - originals[0].offsetLeft : 0;
      let guard = 0;
      while (period > 0 && inner.scrollWidth < track.clientWidth + period && guard++ < 8) addSet();
    };
    addSet();
    measure();
    const setX = gsap.quickSetter(inner, 'x', 'px');
    return {
      measure,
      tick(dt, v) {
        if (period <= 0) return;
        const f = signed ? 1 + Math.max(-4, Math.min(4, v / 500)) : 1 + Math.min(3, Math.abs(v) / 600);
        x -= base * f * dt;
        x = ((x % period) - period) % period;
        setX(x);
      },
      destroy() { inner.querySelectorAll('.is-clone').forEach(n => n.remove()); gsap.set(inner, { clearProps: 'transform' }); }
    };
  }
  function initTickers() {
    const offs = [];
    const tickers = [];
    $$('[data-ticker]').forEach(track => {
      const t = makeTicker(track);
      if (!t) return;
      tickers.push(t);
      const fn = (dt, v) => t.tick(dt, v);
      offs.push(whenVisible(track, vis => toggleConsumer(fn, vis)), () => { toggleConsumer(fn, false); t.destroy(); });
    });
    let rt = 0;
    const remeasure = () => tickers.forEach(t => t.measure());
    const onResize = () => { clearTimeout(rt); rt = setTimeout(remeasure, 200); };
    addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    offs.push(() => removeEventListener('resize', onResize));
    return () => offs.forEach(f => f());
  }

  /* ---------- 04 Year Dial: pinned, scrubbed JAN → JUL; launchpad stamps in; 1 July clicks and inverts ---------- */
  function initDial() {
    const dial = $('[data-dial]');
    if (!dial) return null;
    const rots = $$('.dial-rot', dial);
    const click = $('.dial-click', dial);
    const reel = $('.dr-reel', dial);
    const items = $$('.lp-item', dial);
    const ticks = items.map(i => $('.lp-tick', i));
    const boxes = items.map(i => $('.lp-box', i));
    const count = $('[data-lp-count]', dial);
    const arc = $('.rb-arc', dial);
    const ringA = $('.ring-a', dial);
    const ringB = $('.ring-b', dial);
    const legend = $('.dial-legend', dial);
    const caption = $('.dial-caption', dial);
    const draw = !!DrawSVGPlugin;
    const STEPS = [0.07, 0.23, 0.39, 0.55, 0.71, 0.87]; // where each launchpad item ticks, Jan → Jun
    let month = 0;
    let done = 0;
    let after = false;

    // From-state. The CSS defaults are the end frame (JUL, all ticked). GSAP parses those CSS
    // transforms into px values, so y/rotation are set explicitly, not only yPercent.
    items.forEach(i => i.classList.remove('is-done'));
    if (count) count.textContent = '0';
    if (draw) gsap.set(ticks.concat(arc || []).filter(Boolean), { drawSVG: '0%' });
    gsap.set(rots, { rotation: 0 });
    if (reel) gsap.set(reel, { y: 0, yPercent: 0 });
    if (caption) gsap.set(caption, { autoAlpha: 0 });

    const setDone = n => {
      done = n;
      if (count) count.textContent = String(n);
      items.forEach((it, i) => {
        const on = i < n;
        if (on === it.classList.contains('is-done')) return;
        it.classList.toggle('is-done', on);
        if (draw && ticks[i]) gsap.to(ticks[i], { drawSVG: on ? '100%' : '0%', duration: on ? 0.32 : 0.12, delay: on ? 0.1 : 0, ease: OUT, overwrite: true });
        if (on && boxes[i]) gsap.fromTo(boxes[i], { scale: 1.7 }, { scale: 1, duration: 0.32, ease: 'power3.out', overwrite: true, clearProps: 'transform' });
      });
      if (draw && arc) gsap.to(arc, { drawSVG: (n / 6) * 100 + '%', duration: 0.5, ease: OUT, overwrite: true });
    };
    const setAfter = a => {
      after = a;
      dial.classList.toggle('is-after', a);
      updateHeaderTone(); // scrub lag can flip this after the last scroll event
      if (ringB) gsap.to(ringB, { scale: a ? 440 / 360 : 1, svgOrigin: '0 0', duration: 0.6, ease: a ? 'back.out(1.5)' : OUT, overwrite: true });
      if (ringA) gsap.to(ringA, { scale: a ? 360 / 440 : 1, opacity: a ? 0.45 : 1, svgOrigin: '0 0', duration: 0.6, ease: OUT, overwrite: true });
      if (click) gsap.fromTo(click, { rotation: a ? -5 : 5 }, { rotation: 0, duration: 0.55, ease: 'back.out(3)', overwrite: true });
      if (legend) gsap.to(legend, { autoAlpha: a ? 0 : 1, duration: 0.25, overwrite: true });
      if (caption) gsap.to(caption, { autoAlpha: a ? 1 : 0, duration: 0.32, delay: a ? 0.1 : 0, overwrite: true });
    };
    const update = p => {
      const q = Math.min(1, p / 0.86);
      const m = Math.round(q * 6);
      if (m !== month) {
        month = m;
        if (reel) gsap.to(reel, { yPercent: (-100 * m) / 7, duration: 0.45, ease: OUT, overwrite: true });
      }
      const n = STEPS.filter(s => q >= s).length;
      if (n !== done) setDone(n);
      const a = p >= 0.9;
      if (a !== after) setAfter(a);
    };

    const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: () => update(tl.progress()) });
    tl.to(rots, { rotation: -180, duration: 0.86 }).to({}, { duration: 0.14 });
    ScrollTrigger.create({
      trigger: dial, start: 'top top', pin: true, scrub: 0.5, animation: tl,
      end: () => '+=' + Math.round(window.innerHeight * (window.innerWidth < 768 ? 1.2 : 2.4)),
      anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 2
    });
    return () => {
      dial.classList.remove('is-after');
      updateHeaderTone();
      items.forEach(i => i.classList.add('is-done'));
      if (count) count.textContent = '6';
    };
  }

  /* ---------- 05 features: pinned horizontal track (desktop only) ---------- */
  function initFeaturesPin() {
    const pin = $('.feat-pin');
    const track = $('.feat-track');
    if (!pin || !track) return null;
    const bar = $('.fm-bar i');
    const idx = $('[data-feat-idx]');
    const dist = () => Math.max(0, track.scrollWidth - pin.clientWidth);
    const tween = gsap.to(track, { x: () => -dist(), ease: 'none' });
    const st = ScrollTrigger.create({
      trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: true, animation: tween,
      invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 1,
      onUpdate: self => {
        if (bar) gsap.set(bar, { scaleX: self.progress });
        if (idx) idx.textContent = String(Math.min(8, 1 + Math.floor(self.progress * 8))).padStart(2, '0');
      }
    });
    // keyboard: a focused tile scrolls the page to where the track shows it
    const onFocus = e => {
      const tile = e.target.closest('.tile');
      const d = dist();
      if (!tile || !d) return;
      const p = Math.max(0, Math.min(1, (tile.offsetLeft + tile.offsetWidth / 2 - pin.clientWidth / 2) / d));
      scrollToTarget(Math.round(st.start + p * (st.end - st.start)));
    };
    track.addEventListener('focusin', onFocus);
    return () => track.removeEventListener('focusin', onFocus);
  }

  /* ---------- 05 micro-demos: play on hover/focus (in view on touch), pause offscreen ---------- */
  const DEMOS = {
    dir(tl, d) {
      const tg = $('.dd-phone .tg', d);
      const knob = tg && tg.firstElementChild;
      const off = $('.dd-off', d);
      const on = $('.dd-on', d);
      if (!tg || !knob || !off || !on) return;
      const grey = 'rgba(10,10,10,0.18)';
      tl.set(knob, { x: 0 }).set(tg, { backgroundColor: grey })
        .set(off, { yPercent: 0, autoAlpha: 1 }).set(on, { yPercent: 100, autoAlpha: 0 })
        .to(knob, { x: 16, duration: 0.32 }, 0.5)
        .to(tg, { backgroundColor: '#1E40FF', duration: 0.32 }, '<')
        .to(off, { yPercent: -100, autoAlpha: 0, duration: 0.32 }, '<')
        .to(on, { yPercent: 0, autoAlpha: 1, duration: 0.32 }, '<')
        .to(knob, { x: 0, duration: 0.32 }, '+=1.8')
        .to(tg, { backgroundColor: grey, duration: 0.32 }, '<')
        .to(on, { yPercent: -100, autoAlpha: 0, duration: 0.32 }, '<')
        .fromTo(off, { yPercent: 100 }, { yPercent: 0, autoAlpha: 1, duration: 0.32, immediateRender: false }, '<');
    },
    sync(tl, d) {
      const a = $('.ds-run-a', d);
      const b = $('.ds-run-b', d);
      const na = $('.ds-a', d);
      const nb = $('.ds-b', d);
      const l1 = $('.ds-l1', d);
      const l2 = $('.ds-l2', d);
      if (!a || !b || !na || !nb || !l1 || !l2) return;
      tl.set(a, { xPercent: 0, autoAlpha: 0 }).set(b, { xPercent: 100, autoAlpha: 0 })
        .set([l1, l2], { autoAlpha: 0, y: 8 })
        .to(a, { autoAlpha: 1, duration: 0.15 }, 0.3)
        .to(a, { xPercent: 100, duration: 0.9, ease: IN_OUT }, '<')
        .to(a, { autoAlpha: 0, duration: 0.15 }, '>-0.1')
        .to(nb, { scale: 1.12, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, '<')
        .to(l1, { autoAlpha: 1, y: 0, duration: 0.32 }, '<')
        .to(l1, { autoAlpha: 0, y: -8, duration: 0.25 }, '+=1')
        .to(b, { autoAlpha: 1, duration: 0.15 }, '<')
        .to(b, { xPercent: 0, duration: 0.9, ease: IN_OUT }, '<')
        .to(b, { autoAlpha: 0, duration: 0.15 }, '>-0.1')
        .to(na, { scale: 1.12, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, '<')
        .to(l2, { autoAlpha: 1, y: 0, duration: 0.32 }, '<');
    },
    qr(tl, d) {
      const run = $('.dq-run', d);
      const code = $('.dq-code svg', d);
      const a = $('.dq-a', d);
      const b = $('.dq-b', d);
      const badge = $('.dq-badge', d);
      if (!run || !code || !a || !b || !badge) return;
      tl.set(run, { yPercent: 0, autoAlpha: 0 }).set(a, { yPercent: 0, autoAlpha: 1 })
        .set(b, { yPercent: 100, autoAlpha: 0 }).set(badge, { scale: 0.6, autoAlpha: 0 })
        .to(run, { autoAlpha: 1, duration: 0.15 }, 0.3)
        .to(run, { yPercent: 100, duration: 1.1, ease: IN_OUT }, '<')
        .to(run, { autoAlpha: 0, duration: 0.15 }, '>-0.05')
        .to(code, { opacity: 0.35, duration: 0.08, yoyo: true, repeat: 1 }, '<')
        .to(a, { yPercent: -100, autoAlpha: 0, duration: 0.32 }, '>')
        .to(b, { yPercent: 0, autoAlpha: 1, duration: 0.32 }, '<')
        .to(badge, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.2)' }, '<');
    },
    inv(tl, d) {
      const lines = $$('.di-lines li', d);
      const sum = $('.di-sum', d);
      const chips = $$('.chip', d);
      if (!lines.length || !sum) return;
      const vals = lines.map(li => parseFloat(li.lastElementChild.textContent) || 0);
      const o = { v: vals.reduce((s, v) => s + v, 0) };
      tl.eventCallback('onUpdate', () => { sum.textContent = o.v.toFixed(2); });
      tl.set(lines, { autoAlpha: 0, x: -10 }).set(o, { v: 0 }).set(chips, { autoAlpha: 0.35 });
      let total = 0;
      lines.forEach((li, i) => {
        total += vals[i];
        tl.to(li, { autoAlpha: 1, x: 0, duration: 0.35 }, 0.3 + i * 0.45)
          .to(o, { v: total, duration: 0.4, ease: 'power2.out' }, '<');
      });
      tl.to(chips, { autoAlpha: 1, duration: 0.3, stagger: 0.1 }, '+=0.2');
    },
    chat(tl, d) {
      const bubble = $('.dc-bubble', d);
      const t1 = $('.dc-t1', d);
      const t2 = $('.dc-t2', d);
      const stats = $('.dc-stats', d);
      if (!bubble || !t1 || !t2 || !stats) return;
      tl.set(bubble, { autoAlpha: 0, y: 16, scale: 0.96 }).set([t1, t2], { stroke: '#8A8A84' })
        .set(t2, { autoAlpha: 0 }).set(stats, { autoAlpha: 0 })
        .to(bubble, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.3)
        .to(t2, { autoAlpha: 1, duration: 0.2 }, '+=0.6')
        .to([t1, t2], { stroke: '#1E40FF', duration: 0.3 }, '+=0.7')
        .to(stats, { autoAlpha: 1, duration: 0.4 }, '<');
    },
    proj(tl, d) {
      const btn = $('.dp-btn', d);
      const fill = $('.dp-fill', d);
      const l1 = $('.dp-l1', d);
      const l2 = $('.dp-l2', d);
      if (!btn || !fill || !l1 || !l2) return;
      tl.set(fill, { scaleX: 0 }).set(l1, { autoAlpha: 1, yPercent: 0 }).set(l2, { autoAlpha: 0, yPercent: 60 })
        .to(btn, { scale: 0.97, duration: 0.12, yoyo: true, repeat: 1 }, 0.5)
        .to(fill, { scaleX: 1, duration: 0.9, ease: IN_OUT }, '>')
        .to(l1, { autoAlpha: 0, yPercent: -60, duration: 0.3 }, '>-0.1')
        .to(l2, { autoAlpha: 1, yPercent: 0, duration: 0.35 }, '<');
    },
    grant(tl, d) {
      const stamp = $('.dg-stamp', d);
      const card = $('.dg-card', d);
      if (!stamp || !card) return;
      tl.set(stamp, { autoAlpha: 0, scale: 2.4, rotation: -16 })
        .to(stamp, { autoAlpha: 1, scale: 1, rotation: -8, duration: 0.3, ease: 'power4.in' }, 0.6)
        .to(card, { x: -4, duration: 0.06, yoyo: true, repeat: 3, ease: 'none' }, '>');
    },
    site(tl, d) {
      const ind = $('.dw-ind', d);
      const reel = $('.dw-reel', d);
      if (!ind || !reel) return;
      const n = reel.children.length; // 8 languages + English again, so the loop is seamless
      tl.set(ind, { xPercent: 0 }).set(reel, { yPercent: 0 });
      for (let i = 1; i < n; i++) {
        tl.to(reel, { yPercent: (-100 * i) / n, duration: 0.45 }, 0.4 + (i - 1) * 1.05)
          .to(ind, { xPercent: (i % 8) * 100, duration: 0.45 }, '<');
      }
    }
  };

  function initDemos() {
    const touch = !mqHover.matches;
    const ctl = new Map();
    $$('.tile[data-demo]').forEach(tile => {
      const build = DEMOS[tile.dataset.demo];
      const demo = $('.demo', tile);
      if (!build || !demo) return;
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2, defaults: { ease: OUT } });
      build(tl, demo);
      tl.progress(1).pause(); // rest on the final frame — the same frame the static page shows
      ctl.set(tile, { tl, hover: false, focus: false, view: false, onscreen: false });
    });
    if (!ctl.size) return null;

    const play = (tile, s) => {
      gsap.killTweensOf(s.tl);
      tile.classList.add('is-live');
      if (s.tl.paused()) s.tl.restart();
    };
    const stop = (tile, s) => {
      tile.classList.remove('is-live');
      if (s.tl.paused()) return;
      s.tl.pause();
      gsap.to(s.tl, { progress: 1, duration: 0.5, ease: 'power1.inOut' });
    };
    const update = tile => {
      const s = ctl.get(tile);
      if (!s) return;
      const want = s.onscreen && !pageHidden && (s.hover || s.focus || (touch && s.view));
      if (want) play(tile, s); else stop(tile, s);
    };
    const offs = [];
    ctl.forEach((s, tile) => {
      const on = (key, val) => e => {
        if ((key === 'hover') && e.pointerType !== 'mouse') return;
        s[key] = val;
        update(tile);
      };
      const handlers = [
        ['pointerenter', on('hover', true)], ['pointerleave', on('hover', false)],
        ['focusin', on('focus', true)], ['focusout', on('focus', false)]
      ];
      handlers.forEach(([ev, fn]) => tile.addEventListener(ev, fn));
      offs.push(() => handlers.forEach(([ev, fn]) => tile.removeEventListener(ev, fn)));
      offs.push(whenVisible(tile, (vis, ratio) => { s.onscreen = vis; s.view = ratio >= 0.6; update(tile); }, { threshold: [0, 0.6] }));
    });
    const onVis = () => ctl.forEach((s, tile) => update(tile));
    document.addEventListener('visibilitychange', onVis);
    offs.push(() => document.removeEventListener('visibilitychange', onVis));
    return () => { offs.forEach(f => f()); ctl.forEach((s, tile) => tile.classList.remove('is-live')); };
  }

  /* ---------- 07 districts: one block splits into club blocks that switch on ---------- */
  function initDistricts() {
    const grid = $('.d-grid');
    if (!grid) return null;
    const cells = $$('.d-cell', grid);
    const fills = cells.map(c => c.firstElementChild).filter(el => el && el.tagName === 'I');
    const gap = () => parseFloat(getComputedStyle(grid).columnGap) || 8;
    const grow = size => (size + gap() + 1) / Math.max(1, size);
    gsap.timeline({ scrollTrigger: { trigger: grid, start: 'top 85%', end: 'bottom 45%', scrub: 0.6, invalidateOnRefresh: true } })
      .fromTo(cells,
        { scaleX: (i, el) => grow(el.offsetWidth), scaleY: (i, el) => grow(el.offsetHeight) },
        { scaleX: 1, scaleY: 1, duration: 1, ease: 'power2.inOut' })
      .fromTo(fills, { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: 'power2.out', stagger: { each: 0.03, from: 'random' } }, '>-0.1');
    return null;
  }

  /* ---------- 08 migration: giant day counter 01 → 10, imports tick, report signed at 10 ---------- */
  function initMigration() {
    const sec = $('.migration');
    if (!sec) return null;
    const counter = $('.mig-counter', sec);
    const tens = $('.mc-tens', sec);
    const ones = $('.mc-ones', sec);
    const bar = $('.mc-bar i', sec);
    const body = $('.mig-body', sec);
    const items = $$('.ms-item', sec);
    const ticks = items.map(i => $('.ms-tick', i));
    const report = $('.mig-report', sec);
    const sig = $('.mr-sig path', sec);
    const stamp = $('.mr-stamp', sec);
    if (!counter || !tens || !ones || !body) return null;
    const draw = !!DrawSVGPlugin;
    const AT = [2, 4, 5, 7, 8]; // working day on which each import lands
    let day = 0;

    counter.classList.add('is-importing');
    // the CSS default shows "10" via translateY(-50%); GSAP parses that as px, so zero y explicitly
    gsap.set([tens, ones], { y: 0, yPercent: 0 });
    items.forEach(i => i.classList.remove('is-done'));
    if (draw) gsap.set(ticks.concat(sig || []).filter(Boolean), { drawSVG: '0%' });
    if (report) report.classList.remove('is-signed');
    if (stamp) gsap.set(stamp, { autoAlpha: 0, scale: 1.6, rotation: -4 });

    const setDay = d => {
      if (d === day) return;
      day = d;
      gsap.to(tens, { yPercent: -50 * Math.floor(d / 10), duration: 0.55, ease: OUT, overwrite: true });
      gsap.to(ones, { yPercent: -10 * (d % 10), duration: 0.55, ease: OUT, overwrite: true });
      if (bar) gsap.to(bar, { scaleX: d / 10, duration: 0.4, ease: OUT, overwrite: true });
      items.forEach((it, i) => {
        const on = d >= AT[i];
        if (on === it.classList.contains('is-done')) return;
        it.classList.toggle('is-done', on);
        if (draw && ticks[i]) gsap.to(ticks[i], { drawSVG: on ? '100%' : '0%', duration: on ? 0.4 : 0.15, ease: OUT, overwrite: true });
      });
      const signed = d === 10;
      counter.classList.toggle('is-importing', !signed);
      if (report) report.classList.toggle('is-signed', signed);
      if (draw && sig) gsap.to(sig, { drawSVG: signed ? '100%' : '0%', duration: signed ? 1.1 : 0.2, ease: 'power1.inOut', overwrite: true });
      if (stamp) {
        gsap.to(stamp, signed
          ? { autoAlpha: 1, scale: 1, rotation: -4, duration: 0.35, delay: 0.9, ease: 'power4.in', overwrite: true }
          : { autoAlpha: 0, scale: 1.6, duration: 0.2, overwrite: true });
      }
    };
    setDay(1);
    ScrollTrigger.create({
      trigger: body, start: 'top 75%', end: 'bottom 75%',
      onUpdate: self => setDay(1 + Math.min(9, Math.floor(self.progress * 10)))
    });
    return () => {
      counter.classList.remove('is-importing');
      items.forEach(i => i.classList.add('is-done'));
      if (report) report.classList.add('is-signed');
    };
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  const showStatic = () => {
    $$('[data-reveal], [data-hero]').forEach(el => el.classList.add('is-in'));
    $$('.hero-title, .split-h').forEach(el => el.classList.add('is-split'));
  };
  // no ScrollTrigger: drop html.js so the pinned layouts never apply without their pins
  if (!ScrollTrigger) { showStatic(); root.classList.remove('js'); return; }

  const fontsReady = () => Promise.race([
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    new Promise(r => setTimeout(r, 500))
  ]);
  let hashSettled = false;
  const settleHash = () => {
    if (hashSettled) return;
    hashSettled = true;
    const id = decodeURIComponent(location.hash.slice(1));
    const t = id ? document.getElementById(id) : null;
    if (t) scrollToTarget(t, true);
  };

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', ctx => {
    let alive = true;
    const offs = [initHero(), initDial(), initReveals(), initTickers(), initDistricts(), initMigration(), initDemos()];
    fontsReady().then(() => {
      if (!alive) return;
      ctx.add(() => { offs.push(initHeroTitle(), initHeadings(), initCounters()); });
      if (ScrollTrigger.sort) ScrollTrigger.sort();
      ScrollTrigger.refresh();
      settleHash();
    });
    return () => { alive = false; offs.forEach(off => { if (typeof off === 'function') off(); }); };
  });
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 1024px)', () => initFeaturesPin());
  mm.add('(prefers-reduced-motion: reduce)', () => { showStatic(); });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
