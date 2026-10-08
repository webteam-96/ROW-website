/* ==========================================================================
   Roster On Wheels — Concept 01 · Civic Editorial
   Plain JS + GSAP 3.15 (ScrollTrigger, SplitText, DrawSVG, CustomEase) + Lenis.
   Every feature is guarded: a missing element or library never throws.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const smooth = (a, b, v) => { const t = ramp(a, b, v); return t * t * (3 - 2 * t); };
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const fontsReady = ms => Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(ms)]);
  const media = q => window.matchMedia(q);

  const WIDE = '(min-width: 1200px) and (min-height: 720px)';
  const MOTION = '(prefers-reduced-motion: no-preference)';
  const reduceMotion = media('(prefers-reduced-motion: reduce)');
  const header = $('#site-header');
  const ready = () => doc.classList.add('is-ready');
  let lenisOn = false;

  /** Calls cb(true|false) when `el` enters/leaves the viewport or the tab is hidden/shown. */
  function watch(el, cb, rootMargin = '0px') {
    let inView = false;
    const emit = () => cb(inView && !document.hidden);
    const io = new IntersectionObserver(entries => {
      inView = entries[entries.length - 1].isIntersecting;
      emit();
    }, { rootMargin });
    io.observe(el);
    document.addEventListener('visibilitychange', emit);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', emit);
    };
  }

  /* ------------------------------------------------------------------------
     1. Header: shrink + blur after 80px
     ------------------------------------------------------------------------ */
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------------
     2. Menu (burger at every width): full screen, focus trap, Esc, scroll lock
     ------------------------------------------------------------------------ */
  const burger = $('.burger');
  const mobileMenu = $('#mobile-menu');
  const inertTargets = [$('#main'), $('.site-footer')].filter(Boolean);
  let menuOpen = false;
  let menuTimer = 0;
  const focusables = root => $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', root);

  function setMenu(open, returnFocus = false) {
    if (!burger || !mobileMenu || open === menuOpen) return;
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    doc.classList.toggle('menu-open', open);
    inertTargets.forEach(el => { el.inert = open; });
    clearTimeout(menuTimer);
    const lenis = window.lenis;
    if (open) {
      mobileMenu.hidden = false;
      void mobileMenu.offsetWidth;            // commit the closed state so the fade runs
      mobileMenu.classList.add('is-open');
      if (lenis && typeof lenis.stop === 'function') lenis.stop();
      const first = focusables(mobileMenu)[0];
      if (first) first.focus({ preventScroll: true });
    } else {
      mobileMenu.classList.remove('is-open');
      if (lenis && typeof lenis.start === 'function') lenis.start();
      menuTimer = setTimeout(() => { if (!menuOpen) mobileMenu.hidden = true; }, 340);
      if (returnFocus) burger.focus();
    }
  }

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => setMenu(!menuOpen));
    document.addEventListener('keydown', e => {
      if (!menuOpen) return;
      if (e.key === 'Escape') { setMenu(false, true); return; }
      if (e.key !== 'Tab') return;
      const items = [burger, ...focusables(mobileMenu)];
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!items.includes(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ------------------------------------------------------------------------
     3. In-page anchors: Lenis when active, native otherwise; focus follows
     ------------------------------------------------------------------------ */
  function focusTarget(target) {
    const el = target.tagName === 'DETAILS' ? ($('summary', target) || target) : target;
    if (!el.matches('a[href], button, input, select, textarea, summary, [tabindex]')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  function scrollToTarget(target) {
    const lenis = window.lenis;
    if (lenisOn && lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(target, { force: true, onComplete: () => focusTarget(target) });
    } else {
      target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      focusTarget(target);
    }
  }
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    if (target.tagName === 'DETAILS') target.open = true;
    requestAnimationFrame(() => scrollToTarget(target));   // after the menu releases the scroll lock
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  });

  /* ------------------------------------------------------------------------
     4. FAQ: native <details>, URL hash follows the open question
     ------------------------------------------------------------------------ */
  const faqItems = $$('.faq__item');
  faqItems.forEach(d => d.addEventListener('toggle', () => {
    if (d.open && d.id && location.hash !== `#${d.id}`) history.replaceState(null, '', `#${d.id}`);
  }));
  const openFromHash = () => {
    const id = location.hash.slice(1);
    const el = id ? document.getElementById(decodeURIComponent(id)) : null;
    if (el && el.tagName === 'DETAILS') el.open = true;
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  /* ------------------------------------------------------------------------
     Motion. Without GSAP the page is already complete and static.
     ------------------------------------------------------------------------ */
  const { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase } = window;
  if (!gsap || !ScrollTrigger) { ready(); return; }
  gsap.registerPlugin(...[ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase].filter(Boolean));
  const hasDraw = Boolean(DrawSVGPlugin);
  const OUT = CustomEase ? CustomEase.create('rowOut', '0.22,1,0.36,1') : 'power3.out';
  const IN_OUT = CustomEase ? CustomEase.create('rowInOut', '0.65,0,0.35,1') : 'power2.inOut';
  ScrollTrigger.config({ ignoreMobileResize: true });
  const cssPx = name => parseFloat(getComputedStyle(doc).getPropertyValue(name)) || 0;

  /* ---------- Smooth scroll (fine pointers only) ---------- */
  function setupLenis() {
    if (typeof window.Lenis !== 'function') return undefined;
    const lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    window.lenis = lenis;
    lenisOn = true;
    lenis.on('scroll', ScrollTrigger.update);
    const raf = time => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisOn = false;
      try { delete window.lenis; } catch (err) { window.lenis = undefined; }
      gsap.ticker.lagSmoothing(500, 33);
    };
  }

  /* ---------- Hero: the Roster Wheel collapses into the member app ---------- */
  function heroScene(wide) {
    const hero = $('.hero');
    const stage = $('.hero__stage');
    const frame = $('.wheel__frame');
    const rim = $('.wheel__rim');
    const hub = $('.wheel__hub');
    const phone = $('.phone');
    const list = $('.dir');
    const cards = $$('.wheel__card');
    const rows = $$('.dir__row');
    if (!hero || !stage || !frame || !rim || !hub || !phone || !list || !cards.length || rows.length < cards.length) return undefined;

    const N = cards.length;
    const DEG = Math.PI / 180;
    const state = { p: 0, spin: 0 };
    const appear = cards.map(() => ({ v: 0 }));
    const hubIn = { v: 0 };
    const rowOpacity = rows.map(() => -1);
    let geo = null;
    let ticking = false;

    stage.classList.add('is-live');

    // layout position of `el` inside `ancestor`, ignoring transforms
    function offsetIn(el, ancestor) {
      let x = 0;
      let y = 0;
      let node = el;
      while (node && node !== ancestor) {
        x += node.offsetLeft;
        y += node.offsetTop;
        const parent = node.offsetParent;
        if (parent && parent !== ancestor) { x += parent.clientLeft; y += parent.clientTop; }
        node = parent;
      }
      return { x, y };
    }

    function measure() {
      const hubAt = offsetIn(hub, stage);
      const cx = hubAt.x + hub.offsetWidth / 2;
      const cy = hubAt.y + hub.offsetHeight / 2;
      const R = rim.offsetWidth / 2;
      const cw = cards[0].offsetWidth;
      const ch = cards[0].offsetHeight;
      // cards shrink a little at the top and bottom of the wheel so neighbours never overlap
      const sMin = wide ? clamp((2 * R * Math.sin(Math.PI / N) - 10) / cw, 0.55, 1) : 1;
      const phoneAt = offsetIn(phone, stage);
      const pcx = phoneAt.x + phone.offsetWidth / 2;
      const pcy = phoneAt.y + phone.offsetHeight / 2;
      const listAt = offsetIn(list, stage);
      const listH = list.clientHeight;
      const cardMono = $('.mono', cards[0]);
      const cmx = cardMono ? cardMono.offsetLeft : 0;
      const cmy = cardMono ? cardMono.offsetTop : 0;
      const cmw = cardMono ? cardMono.offsetWidth : cw;
      const targets = cards.map(card => {
        const idx = clamp(Number(card.dataset.row) || 0, 0, rows.length - 1);
        const row = rows[idx];
        const mono = $('.mono', row) || row;
        const at = offsetIn(mono, stage);
        const s = mono.offsetWidth / cmw;
        const visible = row.offsetTop + row.offsetHeight <= listH + 1;
        // land monogram-on-monogram; rows below the fold sink into the list
        const x = at.x - cmx * s;
        const y = visible ? at.y - cmy * s : listAt.y + listH - mono.offsetHeight * 0.4 - cmy * s;
        return { idx, row, s, x, y, visible };
      });
      const order = targets.map((t, i) => i).sort((a, b) => {
        if (targets[a].visible !== targets[b].visible) return targets[a].visible ? -1 : 1;
        return targets[a].idx - targets[b].idx;
      });
      const rank = [];
      order.forEach((cardIndex, r) => { rank[cardIndex] = r; });
      geo = { cx, cy, R, cw, ch, sMin, pcx, pcy, targets, rank };
    }

    function render() {
      if (!geo) return;
      const { cx, cy, R, cw, ch, sMin, pcx, pcy, targets, rank } = geo;
      const p = state.p;
      const spin = state.spin + p * 110;              // the wheel turns faster as it collapses
      const collapse = inOut(smooth(0, 0.62, p));

      frame.style.transform = `rotate(${spin.toFixed(2)}deg) scale(${(1 - collapse * 0.9).toFixed(4)})`;
      frame.style.opacity = ((1 - smooth(0.36, 0.64, p)) * hubIn.v).toFixed(3);

      const hubOut = smooth(0.02, 0.3, p);
      hub.style.opacity = ((1 - hubOut) * hubIn.v).toFixed(3);
      hub.style.transform = `scale(${(lerp(0.7, 1, hubIn.v) * lerp(1, 0.4, hubOut)).toFixed(4)})`;

      // the hub grows into the phone
      const grow = inOut(smooth(0.02, 0.5, p));
      phone.style.opacity = smooth(0.02, 0.16, p).toFixed(3);
      phone.style.transform = `translate3d(${((cx - pcx) * (1 - grow)).toFixed(2)}px, ${((cy - pcy) * (1 - grow)).toFixed(2)}px, 0) scale(${lerp(0.2, 1, grow).toFixed(4)})`;

      for (let i = 0; i < N; i += 1) {
        const tg = targets[i];
        const a = appear[i].v;
        const th = (i * 360 / N + spin - 90) * DEG;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const k = sMin + (1 - sMin) * Math.abs(c);
        const ringX = cx + R * c - (cw * k) / 2;
        const ringY = cy + R * s - (ch * k) / 2;
        const start = 0.08 + rank[i] * (0.46 / N);
        const t = inOut(ramp(start, start + 0.4, p));
        const x = lerp(ringX, tg.x, t);
        const y = lerp(ringY, tg.y, t);
        const sc = lerp(k, tg.s, t) * lerp(0.8, 1, a);
        const fade = tg.visible ? smooth(0.86, 1, t) : smooth(0.5, 0.92, t);
        const card = cards[i];
        card.style.transform = `translate3d(${(x - cx).toFixed(2)}px, ${(y - cy).toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
        card.style.opacity = (a * (1 - fade)).toFixed(3);
        const ro = smooth(0.86, 1, t);
        if (ro !== rowOpacity[tg.idx]) {
          rowOpacity[tg.idx] = ro;
          tg.row.style.opacity = ro.toFixed(3);
        }
      }
    }

    const tick = (time, deltaTime) => {
      if (state.p < 1) state.spin = (state.spin + Math.min(deltaTime, 64) * 0.004) % 360;   // 4°/s
      render();
    };
    const unwatch = watch(stage, on => {
      if (on && !ticking) { gsap.ticker.add(tick); ticking = true; }
      else if (!on && ticking) { gsap.ticker.remove(tick); ticking = false; }
    });

    measure();
    render();

    // members take their seats around the wheel
    gsap.to(hubIn, { v: 1, duration: 0.9, ease: OUT, delay: 0.25 });
    gsap.to(appear, { v: 1, duration: 0.9, ease: OUT, delay: 0.4, stagger: 0.05 });

    const pinEl = wide ? hero : stage;
    gsap.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: () => { if (!ticking) render(); },
      scrollTrigger: {
        trigger: pinEl,
        pin: true,
        start: wide ? 'top top' : () => `top ${cssPx('--hh-s') || 56}px`,
        end: wide ? '+=110%' : '+=70%',
        scrub: lenisOn ? true : 0.5,
        anticipatePin: 1,
        refreshPriority: 2,
        invalidateOnRefresh: true,
      },
    });

    const onRefresh = () => { measure(); render(); };
    ScrollTrigger.addEventListener('refresh', onRefresh);

    return () => {
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      unwatch();
      if (ticking) gsap.ticker.remove(tick);
      stage.classList.remove('is-live');
      [frame, hub, phone, ...cards, ...rows].forEach(el => {
        el.style.transform = '';
        el.style.opacity = '';
      });
    };
  }

  /* ---------- Plan: the Year Dial, scrubbed January → July ---------- */
  function planScene(wide) {
    const section = $('.plan');
    const fig = $('.plan__fig');
    const hand = $('.dial__hand');
    const handWrap = $('.dial__handwrap');
    const arc = $('.dial__arc');
    const current = $('.dial__current');
    const nextFull = $('.dial__nextfull');
    const monthEl = $('[data-dial-month]');
    const stateEl = $('[data-dial-state]');
    if (!section || !fig || !hand || !handWrap || !arc || !current || !nextFull) return undefined;
    const items = $$('.launchpad__item', fig);
    const ticks = items.map(item => $('.launchpad__tick', item));

    let lastKey = '';
    const setReadout = (month, label) => {
      const key = `${month}|${label}`;
      if (key === lastKey) return;
      lastKey = key;
      if (monthEl) monthEl.textContent = month;
      if (stateEl) stateEl.textContent = label;
    };

    // the hand sits in a group pre-rotated to July (270°); January is -180° from there
    gsap.set(hand, { rotation: -180, svgOrigin: '220 220' });
    if (hasDraw) {
      gsap.set(arc, { drawSVG: '0%' });
      gsap.set(ticks.filter(Boolean), { drawSVG: '0%' });
    } else {
      gsap.set(arc, { opacity: 0 });
    }
    gsap.set(items, { '--done': 0 });
    setReadout('January', 'next year');

    // 1 July: the dial clicks and the rings swap
    const swap = gsap.timeline({ paused: true })
      .to(handWrap, { rotation: 4, svgOrigin: '220 220', duration: 0.12, ease: 'power2.out' }, 0)
      .to(handWrap, { rotation: 0, svgOrigin: '220 220', duration: 0.5, ease: OUT }, 0.12)
      .to(arc, { opacity: 0, duration: 0.3 }, 0.05)
      .fromTo(nextFull, { opacity: 0, attr: { r: 138 } }, { opacity: 1, attr: { r: 164 }, duration: 0.8, ease: OUT }, 0.05)
      .to(current, { attr: { r: 138 }, opacity: 0.35, duration: 0.8, ease: OUT }, 0.05);

    let swapped = false;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => {
        const t = tl.time();
        if (t >= 6.05 && !swapped) { swapped = true; swap.play(); }
        else if (t < 5.95 && swapped) { swapped = false; swap.reverse(); }
        if (t >= 6) setReadout('1 July', 'changeover');
        else setReadout('January', 'next year');
      },
      scrollTrigger: wide
        ? { trigger: section, start: 'top top', end: '+=160%', pin: true, scrub: lenisOn ? true : 0.5, anticipatePin: 1, refreshPriority: 1 }
        : { trigger: fig, start: 'top 75%', end: 'bottom 45%', scrub: 0.5 },
    });
    tl.to(hand, { rotation: 0, svgOrigin: '220 220', duration: 6 }, 0);
    if (hasDraw) tl.to(arc, { drawSVG: '100%', duration: 6 }, 0);
    else tl.to(arc, { opacity: 1, duration: 6 }, 0);
    items.forEach((item, i) => {
      const at = 0.6 + i * 1.5;
      if (hasDraw && ticks[i]) tl.to(ticks[i], { drawSVG: '100%', duration: 0.3, ease: OUT }, at);
      tl.to(item, { '--done': 1, duration: 0.3 }, at + 0.15);   // tick draws, then the row tints
    });
    tl.to({}, { duration: 0.8 }, 6);                             // a beat past 1 July before release

    return () => {
      swap.kill();
      lastKey = '';
      setReadout('1 July', 'changeover');
    };
  }

  /* ---------- Hero copy: masked line rise ---------- */
  function revealHero(ctx) {
    const title = $('.hero__title');
    const items = $$('[data-hero-item]');
    if (items.length) gsap.set(items, { opacity: 0, y: 24 });
    if (title) gsap.set(title, { opacity: 0 });
    fontsReady(500).then(() => ctx.add(() => {
      if (title) {
        if (SplitText) {
          SplitText.create(title, {
            type: 'lines',
            mask: 'lines',
            linesClass: 'line',
            tag: 'span',
            autoSplit: true,
            onSplit(self) {
              gsap.set(title, { opacity: 1 });
              return gsap.from(self.lines, { yPercent: 105, duration: 1, ease: OUT, stagger: 0.09 });
            },
          });
        } else {
          gsap.to(title, { opacity: 1, duration: 0.5 });
        }
      }
      if (items.length) gsap.to(items, { opacity: 1, y: 0, duration: 0.8, ease: OUT, stagger: 0.08, delay: 0.15, clearProps: 'all' });
    }));
  }

  /* ---------- Section headings: lines rise in sequence, masked ---------- */
  function splitHeadings(ctx) {
    const heads = $$('[data-split]');
    if (!heads.length) return;
    gsap.set(heads, { opacity: 0 });
    fontsReady(1200).then(() => ctx.add(() => {
      heads.forEach(h => {
        const trigger = { trigger: h, start: 'top 88%', once: true };
        if (!SplitText) {
          gsap.to(h, { opacity: 1, duration: 0.6, scrollTrigger: trigger });
          return;
        }
        SplitText.create(h, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'line',
          tag: 'span',
          autoSplit: true,
          onSplit(self) {
            gsap.set(h, { opacity: 1 });
            return gsap.from(self.lines, { yPercent: 105, duration: 0.9, ease: OUT, stagger: 0.08, scrollTrigger: { ...trigger } });
          },
        });
      });
      ScrollTrigger.refresh();
    }));
  }

  /* ---------- Generic reveal: rise 24px + fade, 60ms stagger ---------- */
  function reveals() {
    const els = $$('[data-reveal]');
    if (!els.length) return;
    gsap.set(els, { opacity: 0, y: 24 });
    ScrollTrigger.batch(els, {
      start: 'top 90%',
      once: true,
      // a jump (nav anchor) fires dozens of triggers in one batch; a plain 60ms stagger then kept the
      // section you landed on blank for ~3s. Whatever is already above the screen just appears.
      onEnter: batch => {
        const passed = batch.filter(el => el.getBoundingClientRect().bottom < 0);
        const live = batch.filter(el => !passed.includes(el));
        if (passed.length) gsap.set(passed, { clearProps: 'all' });
        if (live.length) gsap.to(live, { opacity: 1, y: 0, duration: 0.7, ease: OUT, stagger: Math.min(0.06, 0.36 / live.length), overwrite: true, clearProps: 'all' });
      },
    });
  }

  /* ---------- Proof: count up once over 1.2s, tabular figures ---------- */
  function counters() {
    const fmt = new Intl.NumberFormat('en-US');
    const els = $$('[data-count]');
    const finals = els.map(el => el.textContent);
    els.forEach((el, i) => {
      const end = Number(el.dataset.count) || 0;
      const suffix = el.dataset.suffix || '';
      const obj = { v: 0 };
      el.textContent = fmt.format(0) + suffix;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: () => gsap.to(obj, {
          v: end,
          duration: 1.2,
          ease: OUT,
          onUpdate: () => { el.textContent = fmt.format(Math.round(obj.v)) + suffix; },
          onComplete: () => { el.textContent = finals[i]; },
        }),
      });
    });
    return () => els.forEach((el, i) => { el.textContent = finals[i]; });
  }

  /* ---------- What: records cross the centre rule both ways ---------- */
  function ledger() {
    const fig = $('.ledger');
    const books = $('.ledger__books');
    const token = $('.ledger__token');
    const ri = $$('.ledger__book--ri .ledger__row');
    const rw = $$('.ledger__book--row .ledger__row');
    if (!fig || !books || !token || !ri.length || ri.length !== rw.length) return undefined;
    const all = [...ri, ...rw];
    const olds = all.map(r => $('.lv--old', r));
    const news = all.map(r => $('.lv--new', r));
    const ticks = all.map(r => $('.ledger__ok path', r)).filter(Boolean);
    const okDots = all.map(r => $('.ledger__ok', r)).filter(Boolean);   // the mint disc shows only once its tick is earned
    if ([olds, news, all.map(r => $('.ledger__who', r)), all.map(r => $('.ledger__val', r))].some(list => list.includes(null))) return undefined;

    const reset = () => {
      gsap.set(news, { opacity: 0, yPercent: 0 });
      gsap.set(olds, { opacity: 1, yPercent: 0 });
      gsap.set(ticks, hasDraw ? { drawSVG: '0%' } : { opacity: 0 });
      gsap.set(okDots, { opacity: 0, scale: 0.4 });
      gsap.set(all, { '--ok': 0, '--hl': 0 });
    };
    const flip = (tl, row, at) => {
      tl.to($('.lv--old', row), { opacity: 0, yPercent: -60, duration: 0.3, ease: OUT }, at)
        .fromTo($('.lv--new', row), { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0, duration: 0.45, ease: OUT }, '<0.05');
    };

    let k = 0;
    let current = null;
    let pending = null;
    let started = false;

    // after every record is in step, quietly rewind both books for the next round
    function rewind() {
      current = gsap.timeline({ onComplete: () => { pending = gsap.delayedCall(0.5, cycle); } })
        .to(news, { opacity: 0, duration: 0.4, ease: OUT })
        .to(olds, { opacity: 1, yPercent: 0, duration: 0.4, ease: OUT }, '<0.1')
        .to(ticks, hasDraw ? { drawSVG: '0%', duration: 0.3 } : { opacity: 0, duration: 0.3 }, '<')
        .to(okDots, { opacity: 0, scale: 0.4, duration: 0.3 }, '<');
    }

    function cycle() {
      const inbound = ri[k].dataset.dir === 'in';
      const src = inbound ? ri[k] : rw[k];
      const dst = inbound ? rw[k] : ri[k];
      const box = books.getBoundingClientRect();
      const a = $('.ledger__val', src).getBoundingClientRect();
      const b = $('.ledger__val', dst).getBoundingClientRect();
      token.textContent = $('.ledger__who', src).textContent;   // the row's label: Members, Officers, Club details
      const tl = gsap.timeline({
        defaults: { immediateRender: false },
        onComplete: () => {
          k = (k + 1) % ri.length;
          pending = gsap.delayedCall(k === 0 ? 2.4 : 0.6, k === 0 ? rewind : cycle);
        },
      });
      tl.to(src, { '--hl': 1, duration: 0.3, ease: OUT });
      flip(tl, src, '<');
      tl.set(token, { x: a.left - box.left, y: a.top - box.top - 3, opacity: 0, scale: 0.94 }, '+=0.25')
        .to(token, { opacity: 1, scale: 1, duration: 0.2, ease: OUT })
        .to(token, { x: b.left - box.left, duration: 1, ease: IN_OUT })
        .to(token, { y: '-=14', duration: 0.5, ease: 'sine.out', yoyo: true, repeat: 1 }, '<')
        .to(token, { opacity: 0, duration: 0.2 })
        .to(src, { '--hl': 0, duration: 0.5 }, '<');
      flip(tl, dst, '<');
      tl.fromTo(dst, { '--ok': 1 }, { '--ok': 0, duration: 1.6, ease: 'power1.out' }, '<');
      const okDot = $('.ledger__ok', dst);
      if (okDot) tl.to(okDot, { opacity: 1, scale: 1, duration: 0.3, ease: OUT }, '<');
      const tick = $('.ledger__ok path', dst);
      if (tick) {
        tl.fromTo(tick, hasDraw ? { drawSVG: '0%' } : { opacity: 0 },
          hasDraw ? { drawSVG: '100%', duration: 0.4, ease: OUT } : { opacity: 1, duration: 0.3 }, '<0.1');
      }
      current = tl;
    }

    reset();
    const unwatch = watch(fig, on => {
      if (on) {
        if (!started) { started = true; cycle(); return; }
        if (current) current.resume();
        if (pending) pending.resume();
      } else {
        if (current) current.pause();
        if (pending) pending.pause();
      }
    }, '0px 0px -12% 0px');

    return () => {
      unwatch();
      if (current) current.kill();
      if (pending) pending.kill();
      gsap.set([...all, ...olds, ...news, ...ticks, ...okDots, token], { clearProps: 'all' });
    };
  }

  /* ---------- Bento: looping micro-demos (time 0 is always the rest frame) ---------- */
  // immediateRender: false keeps fromTo() from painting its start state over the rest frame at build time
  const loop = (repeatDelay = 0.8) => gsap.timeline({ paused: true, repeat: -1, repeatDelay, defaults: { immediateRender: false } });
  const DEMOS = {
    privacy(tile) {
      const sw = $('.pv__phone .sw', tile);
      const knob = sw && $('.sw__knob', sw);
      const fill = sw && $('.sw__fill', sw);
      const off = $('.pv__off', tile);
      const on = $('.pv__on', tile);
      const icOff = $('.pv__ic-off', tile);
      const icOn = $('.pv__ic-on', tile);
      if (!knob || !fill || !off || !on || !icOff || !icOn) return null;
      const travel = () => sw.clientWidth - knob.offsetWidth - 4;
      return loop()
        .to(knob, { x: travel, duration: 0.32, ease: OUT }, 0.4)
        .to(fill, { opacity: 1, duration: 0.32, ease: OUT }, '<')
        .to(off, { opacity: 0, yPercent: -40, duration: 0.2 }, '<')
        .fromTo(on, { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, duration: 0.3, ease: OUT }, '<0.08')
        .to(icOff, { opacity: 0, duration: 0.2 }, '<')
        .to(icOn, { opacity: 1, duration: 0.3 }, '<')
        .to(knob, { x: 0, duration: 0.32, ease: OUT }, '+=1.6')
        .to(fill, { opacity: 0, duration: 0.32 }, '<')
        .to(on, { opacity: 0, yPercent: -40, duration: 0.2 }, '<')
        .fromTo(off, { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, duration: 0.3, ease: OUT }, '<0.08')
        .to(icOn, { opacity: 0, duration: 0.2 }, '<')
        .to(icOff, { opacity: 1, duration: 0.3 }, '<')
        .to({}, { duration: 0.6 });
    },

    sync(tile) {
      const runner = $('.sy__runner', tile);
      const dot = $('.sy__dot', tile);
      const nodes = $$('.sy__node', tile);
      const led = $('.sy__led', tile);
      const rest = $('.sy__s--rest', tile);
      const a = $('.sy__s--a', tile);
      const b = $('.sy__s--b', tile);
      if (!runner || !dot || nodes.length < 2 || !rest || !a || !b) return null;
      const tl = loop();
      tl.to(rest, { opacity: 0, duration: 0.2 }, 0.2)
        .to(a, { opacity: 1, duration: 0.25 }, '<0.1')
        .set(dot, { backgroundColor: '#2550F5' }, '<')
        .to(dot, { opacity: 1, duration: 0.2 }, '<')
        .to(runner, { xPercent: 100, duration: 1, ease: IN_OUT })
        .to(dot, { opacity: 0, duration: 0.2 })
        .to(nodes[1], { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<')
        .to(a, { opacity: 0, duration: 0.2 }, '+=0.3')
        .to(b, { opacity: 1, duration: 0.25 }, '<0.1')
        .set(dot, { backgroundColor: '#22B07D' }, '<')
        .to(dot, { opacity: 1, duration: 0.2 }, '<')
        .to(runner, { xPercent: 0, duration: 1, ease: IN_OUT })
        .to(dot, { opacity: 0, duration: 0.2 })
        .to(nodes[0], { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<')
        .to(b, { opacity: 0, duration: 0.2 }, '+=0.1')
        .to(rest, { opacity: 1, duration: 0.25 }, '<0.1');
      if (led) tl.to(led, { scale: 1.8, opacity: 0.4, duration: 0.3, yoyo: true, repeat: 1 }, '<');
      return tl.to({}, { duration: 1 });
    },

    qr(tile) {
      const ok = $('.qr__ok', tile);
      const okPath = $('.qr__ok path', tile);
      const scan = $('.qr__scan', tile);
      const run = $('.qr__scanrun', tile);
      if (!ok || !scan || !run) return null;
      const tl = loop()
        .to(ok, { opacity: 0, duration: 0.25 }, 0.3)
        .to(scan, { opacity: 1, duration: 0.15 })
        .to(run, { yPercent: 100, duration: 0.9, ease: IN_OUT })
        .to(run, { yPercent: 0, duration: 0.7, ease: IN_OUT })
        .to(scan, { opacity: 0, duration: 0.15 })
        .to(ok, { opacity: 1, duration: 0.25 });
      if (okPath && hasDraw) tl.fromTo(okPath, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.4, ease: OUT }, '<');
      return tl.to({}, { duration: 1.6 });
    },

    // lines land one by one and the total bar grows with each (no figures shown)
    dues(tile) {
      const lines = $$('.inv__lines li', tile);
      const sum = $('.inv__sum', tile);
      if (!lines.length || !sum) return null;
      const tl = loop()
        .to(lines, { opacity: 0, duration: 0.2, stagger: 0.03 }, 0.3)
        .to(sum, { scaleX: 0, duration: 0.2 }, '<');
      lines.forEach((line, i) => {
        tl.fromTo(line, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: OUT }, '+=0.15')
          .to(sum, { scaleX: (i + 1) / lines.length, duration: 0.45, ease: OUT }, '<');
      });
      return tl.to({}, { duration: 1.6 });
    },

    chat(tile) {
      const bubble = $('.ch__bubble', tile);
      const t1 = $('.ch__t1', tile);
      const t2 = $('.ch__t2', tile);
      if (!bubble || !t1 || !t2) return null;
      const grey = 'rgba(14, 23, 38, 0.38)';
      return loop()
        .to(bubble, { opacity: 0, y: 6, duration: 0.25 }, 0.3)
        .set([t1, t2], { stroke: grey })
        .set(t2, { opacity: 0 })
        .to(bubble, { opacity: 1, y: 0, duration: 0.45, ease: OUT })
        .to(t2, { opacity: 1, duration: 0.2 }, '+=0.7')
        .to([t1, t2], { stroke: '#2550F5', duration: 0.3 }, '+=0.8')
        .to({}, { duration: 1.6 });
    },

    show(tile) {
      const btn = $('.sp__btn', tile);
      const done = $('.sp__done', tile);
      const tick = $('.sp__done path', tile);
      if (!btn || !done) return null;
      const tl = loop()
        .to(done, { opacity: 0, duration: 0.25 }, 0.3)
        .fromTo(btn, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: OUT })
        .to(btn, { scale: 0.96, duration: 0.12, ease: 'power2.out' }, '+=0.7')
        .to(btn, { scale: 1, duration: 0.25, ease: OUT })
        .to(btn, { opacity: 0, duration: 0.2 }, '+=0.1')
        .fromTo(done, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: OUT }, '<');
      if (tick && hasDraw) tl.fromTo(tick, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.4, ease: OUT }, '<0.1');
      return tl.to({}, { duration: 1.6 });
    },

    grant(tile) {
      const stamp = $('.gr__stamp', tile);
      const ok = $('.gr__s--ok', tile);
      const review = $('.gr__s--review', tile);
      if (!stamp || !ok || !review) return null;
      return loop()
        .to(stamp, { opacity: 0, duration: 0.25 }, 0.3)
        .to(ok, { opacity: 0, duration: 0.2 }, '<')
        .to(review, { opacity: 1, duration: 0.25 }, '<0.1')
        .fromTo(stamp, { opacity: 0, scale: 1.6, rotation: -16 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.5, ease: 'back.out(1.4)' }, '+=1')
        .to(review, { opacity: 0, duration: 0.15 }, '<0.2')
        .to(ok, { opacity: 1, duration: 0.2 }, '<0.05')
        .to({}, { duration: 1.8 });
    },

    // the site flips through the doc's languages; the page skeleton blinks with each switch
    web(tile) {
      const lang = $('.wb__lang', tile);
      if (!lang) return null;
      const names = ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Portuguese'];
      const swap = [lang, ...$$('.wb__club, .wb__lines', tile)];
      const show = i => { lang.textContent = names[i]; };
      show(0);
      const tl = loop(0.4);
      for (let i = 1; i <= names.length; i += 1) {
        tl.to(swap, { opacity: 0, y: -4, duration: 0.18, ease: 'power1.in' }, i === 1 ? 0.6 : '+=0.9')
          .call(show, [i % names.length])
          .fromTo(swap, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.28, ease: OUT });
      }
      return tl.to({}, { duration: 0.8 });
    },
  };

  function bento() {
    const tiles = $$('.tile[data-demo]');
    const finePointer = media('(hover: hover) and (pointer: fine)').matches;
    const offs = [];
    tiles.forEach(tile => {
      const build = DEMOS[tile.dataset.demo];
      const tl = build ? build(tile) : null;
      if (!tl) return;
      let inView = false;
      let engaged = false;
      // fine pointers: play on hover/focus · touch: play while in view
      const wanted = () => inView && !document.hidden && (engaged || !finePointer);
      tl.eventCallback('onRepeat', () => { if (!wanted()) tl.pause(0); });
      const update = () => {
        if (wanted()) tl.play();
        else if (!inView || document.hidden) tl.pause();
        else if (tl.paused() && tl.time() > 0) tl.play();   // finish this loop, then rest
      };
      const onEnter = () => { engaged = true; update(); };
      const onLeave = () => { engaged = tile.contains(document.activeElement); update(); };
      const onFocusOut = e => { if (!tile.contains(e.relatedTarget)) { engaged = tile.matches(':hover'); update(); } };
      tile.addEventListener('pointerenter', onEnter);
      tile.addEventListener('pointerleave', onLeave);
      tile.addEventListener('focusin', onEnter);
      tile.addEventListener('focusout', onFocusOut);
      const unwatch = watch(tile, v => { inView = v; update(); });
      offs.push(() => {
        unwatch();
        tile.removeEventListener('pointerenter', onEnter);
        tile.removeEventListener('pointerleave', onLeave);
        tile.removeEventListener('focusin', onEnter);
        tile.removeEventListener('focusout', onFocusOut);
      });
    });
    return () => offs.forEach(off => off());
  }

  /* ---------- Languages: the eight language names cycle ---------- */
  function languages() {
    const stage = $('.langs__stage');
    const words = $$('.langs__word');
    const items = $$('.langs__list li');
    if (!stage || words.length < 2) return undefined;
    let i = 0;
    let timer = null;
    gsap.set(words, { opacity: 0, yPercent: 100 });
    gsap.set(words[0], { opacity: 1, yPercent: 0 });
    const step = () => {
      const n = (i + 1) % words.length;
      gsap.to(words[i], { yPercent: -100, opacity: 0, duration: 0.8, ease: OUT });
      gsap.fromTo(words[n], { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: OUT });
      if (items[i]) items[i].classList.remove('is-active');
      if (items[n]) items[n].classList.add('is-active');
      i = n;
      timer = gsap.delayedCall(2.2, step);
    };
    const unwatch = watch(stage, on => {
      if (on) {
        if (!timer) timer = gsap.delayedCall(1.4, step);
        else timer.resume();
      } else if (timer) {
        timer.pause();
      }
    });
    return () => {
      unwatch();
      if (timer) timer.kill();
      gsap.killTweensOf(words);
      gsap.set(words, { clearProps: 'all' });
      items.forEach((item, j) => item.classList.toggle('is-active', j === 0));
      words.forEach((word, j) => word.classList.toggle('is-active', j === 0));
    };
  }

  /* ---------- Districts: dotted routes draw out, clubs switch on ---------- */
  function districts() {
    const svg = $('.fan');
    const group = svg && $('.fan__routes', svg);
    if (!svg || !group || !hasDraw) return undefined;
    const routes = $$('path', group);
    const clubs = $$('.fan__club', svg);
    if (!routes.length) return undefined;

    const NS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(NS, 'defs');
    const mask = document.createElementNS(NS, 'mask');
    mask.setAttribute('id', 'fan-mask');
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '0');
    mask.setAttribute('y', '0');
    mask.setAttribute('width', '640');
    mask.setAttribute('height', '440');
    const reveals = routes.map(route => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', route.getAttribute('d'));
      path.setAttribute('class', 'fan__reveal');
      mask.appendChild(path);
      return path;
    });
    defs.appendChild(mask);
    svg.insertBefore(defs, svg.firstChild);
    group.setAttribute('mask', 'url(#fan-mask)');
    svg.classList.add('is-live');
    gsap.set(reveals, { drawSVG: '0%' });

    const order = routes.map((r, i) => i).sort((a, b) => routes[a].getTotalLength() - routes[b].getTotalLength());
    const STEP = 0.16;
    const total = (order.length - 1) * STEP + 1;
    const thresholds = [];
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => {
        const p = tl.progress();
        clubs.forEach((club, i) => club.classList.toggle('is-on', thresholds[i] !== undefined && p >= thresholds[i]));
      },
      scrollTrigger: { trigger: svg, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
    });
    order.forEach((routeIndex, j) => {
      tl.to(reveals[routeIndex], { drawSVG: '100%', duration: 1 }, j * STEP);
      thresholds[routeIndex] = (j * STEP + 0.92) / total;
    });

    return () => {
      group.removeAttribute('mask');
      defs.remove();
      svg.classList.remove('is-live');
      clubs.forEach(club => club.classList.remove('is-on'));
    };
  }

  /* ---------- Migration: ten working days, then the signed report ---------- */
  function migration() {
    const fig = $('.almanac');
    if (!fig) return;
    const progress = $('.almanac__progress', fig);
    const days = $$('.almanac__day', fig);
    const ticks = days.map(day => $('.almanac__tick path', day));
    const oks = $$('.report__ok path', fig);
    const sig = $('.report__sig path', fig);
    const stamp = $('.report__stamp', fig);

    if (progress) gsap.set(progress, { '--p': 0 });
    gsap.set(days, { '--on': 0 });
    if (hasDraw) gsap.set([...ticks, ...oks, sig].filter(Boolean), { drawSVG: '0%' });
    if (stamp) gsap.set(stamp, { opacity: 0, scale: 1.4 });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: fig, start: 'top 78%', end: 'bottom 70%', scrub: 0.6 },
    });
    if (progress) tl.to(progress, { '--p': 1, duration: 10 }, 0);
    days.forEach((day, i) => {
      tl.to(day, { '--on': 1, duration: 0.5 }, i + 0.45);
      if (hasDraw && ticks[i]) tl.to(ticks[i], { drawSVG: '100%', duration: 0.4, ease: OUT }, i + 0.5);
    });
    if (hasDraw) oks.forEach((ok, i) => tl.to(ok, { drawSVG: '100%', duration: 0.35, ease: OUT }, 6.5 + i * 0.5));
    if (hasDraw && sig) tl.to(sig, { drawSVG: '100%', duration: 1.4, ease: 'power1.inOut' }, 9.6);
    if (stamp) tl.to(stamp, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, 10.8);
  }

  /* ---------- Magnetic primary CTA (hero + closing band, max 6px lean) ---------- */
  function magnetic() {
    if (!media('(hover: hover) and (pointer: fine)').matches) return undefined;
    const offs = $$('[data-magnetic]').map(btn => {
      const move = e => {
        const r = btn.getBoundingClientRect();
        let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        btn.style.setProperty('--mx', `${(dx * 6).toFixed(2)}px`);
        btn.style.setProperty('--my', `${(dy * 6).toFixed(2)}px`);
      };
      const leave = () => {
        btn.style.removeProperty('--mx');
        btn.style.removeProperty('--my');
      };
      btn.addEventListener('pointermove', move);
      btn.addEventListener('pointerleave', leave);
      return () => {
        btn.removeEventListener('pointermove', move);
        btn.removeEventListener('pointerleave', leave);
        leave();
      };
    });
    return () => offs.forEach(off => off());
  }

  /* ---------- Static ring (reduced motion): members the phone would cover step aside ---------- */
  // CSS hides the usual five on wide screens; short wide screens (1280×720) also put cards under the
  // phone's corners, so measure instead of guessing.
  function staticRing() {
    const cards = $$('.wheel__card');
    const phone = $('.phone');
    if (!cards.length || !phone) return undefined;
    const fit = () => {
      const b = phone.getBoundingClientRect();
      cards.forEach(card => {
        const r = card.getBoundingClientRect();
        const hit = r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom;
        card.style.visibility = hit ? 'hidden' : '';
      });
    };
    fit();
    fontsReady(2000).then(fit);   // the hero copy can reflow once the fonts arrive, moving the wheel
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      cards.forEach(card => { card.style.visibility = ''; });
    };
  }

  /* ------------------------------------------------------------------------
     Wire it up. Order matters: smooth scroll, then pins (page order), then
     everything that sits below them.
     ------------------------------------------------------------------------ */
  const mm = gsap.matchMedia();

  mm.add(`${MOTION} and (pointer: fine)`, setupLenis);

  mm.add({ motion: MOTION, wide: WIDE }, ctx => {
    if (!ctx.conditions.motion) return undefined;
    const wide = Boolean(ctx.conditions.wide);
    const cleanups = [heroScene(wide), planScene(wide)];
    return () => cleanups.forEach(fn => { if (typeof fn === 'function') fn(); });
  });

  mm.add(MOTION, ctx => {
    revealHero(ctx);
    reveals();
    splitHeadings(ctx);
    migration();
    const cleanups = [counters(), ledger(), bento(), languages(), districts(), magnetic()];
    return () => cleanups.forEach(fn => { if (typeof fn === 'function') fn(); });
  });

  mm.add('(prefers-reduced-motion: reduce)', staticRing);

  ready();
  fontsReady(2000).then(() => ScrollTrigger.refresh());
})();
